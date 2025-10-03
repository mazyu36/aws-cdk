import { Template } from '../../assertions';
import * as iam from '../../aws-iam';
import * as s3 from '../../aws-s3';
import { Duration, Size, Stack } from '../../core';
import * as firehose from '../lib';

describe('IcebergDestination', () => {
  let stack: Stack;
  let bucket: s3.IBucket;

  beforeEach(() => {
    stack = new Stack();
    bucket = new s3.Bucket(stack, 'TestBucket');
  });

  test('creates Iceberg destination with minimal configuration', () => {
    // GIVEN
    const destination = new firehose.IcebergDestination({
      catalogConfiguration: {
        catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
      },
      s3Configuration: {
        bucket,
      },
    });

    // WHEN
    new firehose.DeliveryStream(stack, 'DeliveryStream', {
      destination,
    });

    // THEN
    const template = Template.fromStack(stack);

    // Check that IcebergDestinationConfiguration exists
    template.hasResourceProperties('AWS::KinesisFirehose::DeliveryStream', {
      IcebergDestinationConfiguration: {
        CatalogConfiguration: {
          CatalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        },
      },
    });

    // Verify IAM role is created
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'firehose.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });
  });

  test('creates Iceberg destination with full configuration', () => {
    // GIVEN
    const role = new iam.Role(stack, 'CustomRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    const destination = new firehose.IcebergDestination({
      catalogConfiguration: {
        catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        warehouseLocation: 's3://my-warehouse-bucket/warehouse/',
      },
      s3Configuration: {
        bucket,
        bufferingInterval: Duration.seconds(120),
        bufferingSize: Size.mebibytes(10),
        prefix: 'data/',
        errorOutputPrefix: 'errors/',
      },
      appendOnly: true,
      destinationTableConfigurationList: [
        {
          tableName: 'my_table',
          databaseName: 'my_database',
          uniqueKeys: ['id'],
        },
      ],
      schemaEvolutionConfiguration: {
        enabled: true,
      },
      tableCreationConfiguration: {
        enabled: true,
      },
      s3BackupMode: firehose.IcebergS3BackupMode.FAILED_DATA_ONLY,
      retryOptions: {
        duration: Duration.hours(12),
      },
      role,
    });

    // WHEN
    new firehose.DeliveryStream(stack, 'DeliveryStream', {
      destination,
    });

    // THEN
    const template = Template.fromStack(stack);

    // Check core Iceberg configuration
    template.hasResourceProperties('AWS::KinesisFirehose::DeliveryStream', {
      IcebergDestinationConfiguration: {
        CatalogConfiguration: {
          CatalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
          WarehouseLocation: 's3://my-warehouse-bucket/warehouse/',
        },
        AppendOnly: true,
        s3BackupMode: 'FailedDataOnly',
      },
    });

    // Verify destination table configuration
    template.hasResourceProperties('AWS::KinesisFirehose::DeliveryStream', {
      IcebergDestinationConfiguration: {
        DestinationTableConfigurationList: [
          {
            DestinationTableName: 'my_table',
            DestinationDatabaseName: 'my_database',
            UniqueKeys: ['id'],
          },
        ],
      },
    });
  });

  test('grants necessary IAM permissions', () => {
    // GIVEN
    const destination = new firehose.IcebergDestination({
      catalogConfiguration: {
        catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
      },
      s3Configuration: {
        bucket,
      },
    });

    // WHEN
    new firehose.DeliveryStream(stack, 'DeliveryStream', {
      destination,
    });

    // THEN
    const template = Template.fromStack(stack);

    // Check that IAM role and policy are created
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.resourceCountIs('AWS::IAM::Policy', 1);

    // Verify the policy contains Glue permissions
    const policies = template.findResources('AWS::IAM::Policy');
    const policyDocument = Object.values(policies)[0].Properties.PolicyDocument;
    const statements = policyDocument.Statement;

    // Should have at least one statement with Glue permissions
    const hasGluePermissions = statements.some(
      (stmt: any) => stmt.Action && stmt.Action.includes('glue:GetTable'),
    );
    expect(hasGluePermissions).toBe(true);
  });

  test('grants additional permissions for table creation', () => {
    // GIVEN
    const destination = new firehose.IcebergDestination({
      catalogConfiguration: {
        catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
      },
      s3Configuration: {
        bucket,
      },
      tableCreationConfiguration: {
        enabled: true,
      },
    });

    // WHEN
    new firehose.DeliveryStream(stack, 'DeliveryStream', {
      destination,
    });

    // THEN
    const template = Template.fromStack(stack);
    const policies = template.findResources('AWS::IAM::Policy');
    const policyDocument = Object.values(policies)[0].Properties.PolicyDocument;
    const statements = policyDocument.Statement;

    // Should have statements with both basic Glue permissions and table creation permissions
    const hasCreateTablePermissions = statements.some(
      (stmt: any) => stmt.Action && stmt.Action.includes('glue:CreateTable'),
    );
    expect(hasCreateTablePermissions).toBe(true);
  });

  test('grants additional permissions for schema evolution', () => {
    // GIVEN
    const destination = new firehose.IcebergDestination({
      catalogConfiguration: {
        catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        warehouseLocation: 's3://my-warehouse-bucket/warehouse/',
      },
      s3Configuration: {
        bucket,
      },
      schemaEvolutionConfiguration: {
        enabled: true,
      },
    });

    // WHEN
    new firehose.DeliveryStream(stack, 'DeliveryStream', {
      destination,
    });

    // THEN
    const template = Template.fromStack(stack);
    const policies = template.findResources('AWS::IAM::Policy');
    const policyDocument = Object.values(policies)[0].Properties.PolicyDocument;
    const statements = policyDocument.Statement;

    // Should have statements with schema evolution permissions
    const hasSchemaEvolutionPermissions = statements.some(
      (stmt: any) =>
        stmt.Action && stmt.Action.includes('glue:GetTableVersions'),
    );
    expect(hasSchemaEvolutionPermissions).toBe(true);
  });

  test('validates catalog ARN format', () => {
    expect(() => {
      new firehose.IcebergDestination({
        catalogConfiguration: {
          catalogArn: 'invalid-arn',
        },
        s3Configuration: {
          bucket,
        },
      });
    }).toThrow(/Invalid catalog ARN format/);
  });

  test('validates warehouse location is required for schema evolution', () => {
    expect(() => {
      new firehose.IcebergDestination({
        catalogConfiguration: {
          catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        },
        s3Configuration: {
          bucket,
        },
        schemaEvolutionConfiguration: {
          enabled: true,
        },
      });
    }).toThrow(/Warehouse location must be specified/);
  });

  test('validates buffering interval range', () => {
    expect(() => {
      new firehose.IcebergDestination({
        catalogConfiguration: {
          catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        },
        s3Configuration: {
          bucket,
          bufferingInterval: Duration.seconds(1000), // > 900 seconds
        },
      });
    }).toThrow(/Buffering interval must be between 0 and 900 seconds/);
  });

  test('validates buffering size range', () => {
    expect(() => {
      new firehose.IcebergDestination({
        catalogConfiguration: {
          catalogArn: 'arn:aws:glue:us-east-1:123456789012:catalog',
        },
        s3Configuration: {
          bucket,
          bufferingSize: Size.mebibytes(200), // > 128 MiB
        },
      });
    }).toThrow(/Buffering size must be between 1 and 128 MiB/);
  });
});
