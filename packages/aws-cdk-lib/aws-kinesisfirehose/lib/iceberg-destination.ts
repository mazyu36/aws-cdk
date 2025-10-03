import { Construct } from 'constructs';
import { CommonDestinationProps } from './common';
import { DestinationBindOptions, DestinationConfig, IDestination } from './destination';
import { CfnDeliveryStream } from './kinesisfirehose.generated';
import * as iam from '../../aws-iam';
import * as s3 from '../../aws-s3';
import { createBufferingHints, createLoggingOptions, createProcessingConfig } from './private/helpers';
import { Duration, Size, Token, UnscopedValidationError } from '../../core';

/**
 * Configuration for the Glue Data Catalog used by Iceberg destination.
 */
export interface CatalogConfiguration {
  /**
   * The ARN of the Glue Data Catalog.
   *
   * @example 'arn:aws:glue:us-east-1:123456789012:catalog'
   */
  readonly catalogArn: string;

  /**
   * The warehouse location in Amazon S3 where Iceberg table data is stored.
   *
   * This is required when schema evolution is enabled.
   *
   * @default - No warehouse location specified
   */
  readonly warehouseLocation?: string;
}

/**
 * Configuration for destination table settings.
 */
export interface DestinationTableConfiguration {
  /**
   * The name of the destination table.
   */
  readonly tableName: string;

  /**
   * The name of the destination database.
   */
  readonly databaseName: string;

  /**
   * Unique identifier for the table configuration.
   *
   * @default - Auto-generated unique identifier
   */
  readonly uniqueKeys?: string[];
}

/**
 * Configuration for schema evolution in Iceberg tables.
 */
export interface SchemaEvolutionConfiguration {
  /**
   * Whether to enable schema evolution.
   *
   * @default false
   */
  readonly enabled?: boolean;
}

/**
 * Configuration for automatic table creation in Glue Data Catalog.
 */
export interface TableCreationConfiguration {
  /**
   * Whether to enable automatic table creation.
   *
   * @default false
   */
  readonly enabled?: boolean;
}

/**
 * S3 backup mode for Iceberg destination.
 */
export enum IcebergS3BackupMode {
  /**
   * Only records that failed to deliver are backed up to S3.
   */
  FAILED_DATA_ONLY = 'FailedDataOnly',
}

/**
 * Retry configuration for Iceberg destination.
 */
export interface RetryOptions {
  /**
   * The period of time during which Firehose retries to deliver data to the Iceberg destination.
   *
   * @default Duration.hours(24)
   */
  readonly duration?: Duration;
}

/**
 * Configuration for S3 storage used by Iceberg destination.
 */
export interface IcebergS3Configuration {
  /**
   * The S3 bucket for storing Iceberg table data.
   */
  readonly bucket: s3.IBucket;

  /**
   * The length of time that Firehose buffers incoming data before delivering it to the S3 bucket.
   *
   * @default Duration.seconds(300)
   */
  readonly bufferingInterval?: Duration;

  /**
   * The size of the buffer that Firehose uses for incoming data before delivering it to the S3 bucket.
   *
   * @default Size.mebibytes(5)
   */
  readonly bufferingSize?: Size;

  /**
   * A prefix that Firehose evaluates and adds to records before writing them to S3.
   *
   * @default - No prefix
   */
  readonly prefix?: string;

  /**
   * A prefix that Firehose evaluates and adds to failed records before writing them to S3.
   *
   * @default - No error prefix
   */
  readonly errorOutputPrefix?: string;
}

/**
 * Props for defining an Iceberg destination of an Amazon Data Firehose delivery stream.
 */
export interface IcebergDestinationProps extends CommonDestinationProps {
  /**
   * Configuration for the Glue Data Catalog.
   */
  readonly catalogConfiguration: CatalogConfiguration;

  /**
   * The S3 bucket where Iceberg table data will be stored.
   */
  readonly s3Configuration: IcebergS3Configuration;

  /**
   * Whether to use append-only mode for better performance with insert-only workloads.
   *
   * @default false
   */
  readonly appendOnly?: boolean;

  /**
   * Configuration for destination tables.
   *
   * @default - No destination table configuration
   */
  readonly destinationTableConfigurationList?: DestinationTableConfiguration[];

  /**
   * Configuration for schema evolution.
   *
   * @default - Schema evolution disabled
   */
  readonly schemaEvolutionConfiguration?: SchemaEvolutionConfiguration;

  /**
   * Configuration for automatic table creation.
   *
   * @default - Automatic table creation disabled
   */
  readonly tableCreationConfiguration?: TableCreationConfiguration;

  /**
   * The S3 backup mode for failed records.
   *
   * @default IcebergS3BackupMode.FAILED_DATA_ONLY
   */
  readonly s3BackupMode?: IcebergS3BackupMode;

  /**
   * Retry configuration for delivery failures.
   *
   * @default - 24 hour retry period
   */
  readonly retryOptions?: RetryOptions;
}

/**
 * An Iceberg destination for data from an Amazon Data Firehose delivery stream.
 *
 * @example
 * const bucket = new s3.Bucket(this, 'IcebergBucket');
 * const destination = new IcebergDestination({
 *   catalogConfiguration: {
 *     catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
 *   },
 *   s3Configuration: {
 *     bucket: bucket,
 *   },
 * });
 * new DeliveryStream(this, 'DeliveryStream', {
 *   destination: destination,
 * });
 */
export class IcebergDestination implements IDestination {
  constructor(private readonly props: IcebergDestinationProps) {
    this.validateProps();
  }

  bind(scope: Construct, _options: DestinationBindOptions): DestinationConfig {
    const role = this.props.role ?? new iam.Role(scope, 'Iceberg Destination Role', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    // Grant S3 permissions
    const bucketGrant = this.props.s3Configuration.bucket.grantReadWrite(role);

    // Grant Glue permissions
    this.grantGluePermissions(role);

    const { loggingOptions, dependables: loggingDependables } = createLoggingOptions(scope, {
      loggingConfig: this.props.loggingConfig,
      role,
      streamId: 'IcebergDestination',
    }) ?? {};

    const icebergConfig: any = {
      catalogConfiguration: {
        catalogArn: this.props.catalogConfiguration.catalogArn,
        warehouseLocation: this.props.catalogConfiguration.warehouseLocation,
      },
      roleArn: role.roleArn,
      s3Configuration: {
        bucketArn: this.props.s3Configuration.bucket.bucketArn,
        bufferingHints: createBufferingHints(
          scope,
          this.props.s3Configuration.bufferingInterval,
          this.props.s3Configuration.bufferingSize,
        ),
        prefix: this.props.s3Configuration.prefix,
        errorOutputPrefix: this.props.s3Configuration.errorOutputPrefix,
        roleArn: role.roleArn,
      },
      appendOnly: this.props.appendOnly,
      destinationTableConfigurationList: this.props.destinationTableConfigurationList?.map(config => ({
        destinationTableName: config.tableName,
        destinationDatabaseName: config.databaseName,
        uniqueKeys: config.uniqueKeys,
      })),
      schemaEvolutionConfiguration: this.props.schemaEvolutionConfiguration?.enabled ? {
        enabled: this.props.schemaEvolutionConfiguration.enabled,
      } : undefined,
      tableCreationConfiguration: this.props.tableCreationConfiguration?.enabled ? {
        enabled: this.props.tableCreationConfiguration.enabled,
      } : undefined,
      s3BackupMode: this.props.s3BackupMode ?? IcebergS3BackupMode.FAILED_DATA_ONLY,
      retryOptions: this.props.retryOptions ? {
        durationInSeconds: this.props.retryOptions.duration?.toSeconds() ?? Duration.hours(24).toSeconds(),
      } : undefined,
      cloudWatchLoggingOptions: loggingOptions,
      processingConfiguration: createProcessingConfig(scope, role, this.props.processor),
    };

    return {
      extendedS3DestinationConfiguration: undefined,
      icebergDestinationConfiguration: icebergConfig as CfnDeliveryStream.IcebergDestinationConfigurationProperty,
      dependables: [bucketGrant, ...(loggingDependables ?? [])],
    };
  }

  private validateProps(): void {
    // Validate catalog ARN format
    const catalogArn = this.props.catalogConfiguration.catalogArn;
    if (!Token.isUnresolved(catalogArn)) {
      if (!catalogArn.match(/^arn:[^:]+:glue:[^:]+:[^:]+:catalog$/)) {
        throw new UnscopedValidationError(
          `Invalid catalog ARN format: '${catalogArn}'. ` +
          'Expected format: arn:partition:glue:region:account-id:catalog',
        );
      }
    }

    // Validate warehouse location is provided when schema evolution is enabled
    if (this.props.schemaEvolutionConfiguration?.enabled && !this.props.catalogConfiguration.warehouseLocation) {
      throw new UnscopedValidationError(
        'Warehouse location must be specified in catalogConfiguration when schema evolution is enabled',
      );
    }

    // Validate buffering interval
    const bufferingInterval = this.props.s3Configuration.bufferingInterval;
    if (bufferingInterval && !Token.isUnresolved(bufferingInterval)) {
      if (bufferingInterval.toSeconds() < 0 || bufferingInterval.toSeconds() > 900) {
        throw new UnscopedValidationError(
          `Buffering interval must be between 0 and 900 seconds, got ${bufferingInterval.toSeconds()} seconds`,
        );
      }
    }

    // Validate buffering size
    const bufferingSize = this.props.s3Configuration.bufferingSize;
    if (bufferingSize && !Token.isUnresolved(bufferingSize)) {
      const sizeInMiB = bufferingSize.toMebibytes();
      if (sizeInMiB < 1 || sizeInMiB > 128) {
        throw new UnscopedValidationError(
          `Buffering size must be between 1 and 128 MiB, got ${sizeInMiB} MiB`,
        );
      }
    }
  }

  private grantGluePermissions(role: iam.IRole): void {
    // Grant necessary Glue permissions for Iceberg destination
    role.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'glue:GetTable',
        'glue:GetDatabase',
        'glue:GetPartitions',
      ],
      resources: ['*'], // Glue permissions are typically granted on all resources
    }));

    // Additional permissions for table creation if enabled
    if (this.props.tableCreationConfiguration?.enabled) {
      role.addToPrincipalPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:CreateTable',
          'glue:UpdateTable',
        ],
        resources: ['*'],
      }));
    }

    // Additional permissions for schema evolution if enabled
    if (this.props.schemaEvolutionConfiguration?.enabled) {
      role.addToPrincipalPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:UpdateTable',
          'glue:GetTableVersions',
        ],
        resources: ['*'],
      }));
    }
  }
}
