import * as crypto from 'crypto';
import { Construct } from 'constructs';
import { Code } from './code';
import { Runtime, RuntimeFamily } from './runtime';
import { Schedule } from './schedule';
import { CloudWatchSyntheticsMetrics } from './synthetics-canned-metrics.generated';
import { CfnCanary } from './synthetics.generated';
import { Metric, MetricOptions, MetricProps } from '../../aws-cloudwatch';
import * as ec2 from '../../aws-ec2';
import * as iam from '../../aws-iam';
import * as kms from '../../aws-kms';
import * as s3 from '../../aws-s3';
import * as cdk from '../../core';
import { UnscopedValidationError, ValidationError } from '../../core/lib/errors';
import { addConstructMetadata, MethodMetadata } from '../../core/lib/metadata-resource';
import { propertyInjectable } from '../../core/lib/prop-injectable';
import { AutoDeleteUnderlyingResourcesProvider } from '../../custom-resource-handlers/dist/aws-synthetics/auto-delete-underlying-resources-provider.generated';

const AUTO_DELETE_UNDERLYING_RESOURCES_RESOURCE_TYPE = 'Custom::SyntheticsAutoDeleteUnderlyingResources';
const AUTO_DELETE_UNDERLYING_RESOURCES_TAG = 'aws-cdk:auto-delete-underlying-resources';

/**
 * Specify a test that the canary should run
 */
export class Test {
  /**
   * Specify a custom test with your own code
   *
   * @returns `Test` associated with the specified Code object
   * @param options The configuration options
   */
  public static custom(options: CustomTestOptions): Test {
    return new Test(options.code, options.handler);
  }

  /**
   * Construct a Test property
   *
   * @param code The code that the canary should run
   * @param handler The handler of the canary
   */
  private constructor(public readonly code: Code, public readonly handler: string) {
  }
}

/**
 * Properties for specifying a test
 */
export interface CustomTestOptions {
  /**
   * The code of the canary script
   */
  readonly code: Code;

  /**
   * The handler for the code. Must end with `.handler`.
   */
  readonly handler: string;
}

/**
 * Different ways to clean up underlying Canary resources
 * when the Canary is deleted.
 */
export enum Cleanup {
  /**
   * Clean up nothing. The user is responsible for cleaning up
   * all resources left behind by the Canary.
   */
  NOTHING = 'nothing',

  /**
   * Clean up the underlying Lambda function only. The user is
   * responsible for cleaning up all other resources left behind
   * by the Canary.
   */
  LAMBDA = 'lambda',
}

/**
 * Resources that tags applied to a canary should be replicated to.
 */
export enum ResourceToReplicateTags {
  /**
   * Replicate canary tags to the Lambda function.
   *
   * When specified, CloudWatch Synthetics will keep the tags of the canary
   * and the Lambda function synchronized. Any future changes made to the
   * canary's tags will also be applied to the function.
   */
  LAMBDA_FUNCTION = 'lambda-function',
}

/**
 * Options for specifying the s3 location that stores the data of each canary run. The artifacts bucket location **cannot**
 * be updated once the canary is created.
 */
export interface ArtifactsBucketLocation {
  /**
   * The s3 location that stores the data of each run.
   */
  readonly bucket: s3.IBucket;

  /**
   * The S3 bucket prefix. Specify this if you want a more specific path within the artifacts bucket.
   *
   * @default - no prefix
   */
  readonly prefix?: string;
}

/**
 * Properties for a canary
 */
export interface CanaryProps {
  /**
   * The s3 location that stores the data of the canary runs.
   *
   * @default - A new s3 bucket will be created without a prefix.
   */
  readonly artifactsBucketLocation?: ArtifactsBucketLocation;

  /**
   * Canary execution role.
   *
   * This is the role that will be assumed by the canary upon execution.
   * It controls the permissions that the canary will have. The role must
   * be assumable by the AWS Lambda service principal.
   *
   * If not supplied, a role will be created with all the required permissions.
   * If you provide a Role, you must add the required permissions.
   *
   * @see required permissions: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-synthetics-canary.html#cfn-synthetics-canary-executionrolearn
   *
   * @default - A unique role will be generated for this canary.
   * You can add permissions to roles by calling 'addToRolePolicy'.
   */
  readonly role?: iam.IRole;

  /**
   * How long the canary will be in a 'RUNNING' state. For example, if you set `timeToLive` to be 1 hour and `schedule` to be `rate(10 minutes)`,
   * your canary will run at 10 minute intervals for an hour, for a total of 6 times.
   *
   * @default - no limit
   */
  readonly timeToLive?: cdk.Duration;

  /**
   * Specify the schedule for how often the canary runs. For example, if you set `schedule` to `rate(10 minutes)`, then the canary will run every 10 minutes.
   * You can set the schedule with `Schedule.rate(Duration)` (recommended) or you can specify an expression using `Schedule.expression()`.
   * @default 'rate(5 minutes)'
   */
  readonly schedule?: Schedule;

  /**
   * The amount of times the canary will automatically retry a failed run.
   * This is only supported on the following runtimes or newer: `Runtime.SYNTHETICS_NODEJS_PUPPETEER_10_0`, `Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_2_0`, `Runtime.SYNTHETICS_PYTHON_SELENIUM_5_1`.
   * Max retries can be set between 0 and 2. Canaries which time out after 10 minutes are automatically limited to one retry.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_autoretry.html
   * @default 0
   */
  readonly maxRetries?: number;

  /**
   * Whether or not the canary should start after creation.
   *
   * @default true
   */
  readonly startAfterCreation?: boolean;

  /**
   * How many days should successful runs be retained.
   *
   * @default Duration.days(31)
   */
  readonly successRetentionPeriod?: cdk.Duration;

  /**
   * How many days should failed runs be retained.
   *
   * @default Duration.days(31)
   */
  readonly failureRetentionPeriod?: cdk.Duration;

  /**
   * The name of the canary. Be sure to give it a descriptive name that distinguishes it from
   * other canaries in your account.
   *
   * Do not include secrets or proprietary information in your canary name. The canary name
   * makes up part of the canary ARN, which is included in outbound calls over the internet.
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/servicelens_canaries_security.html
   *
   * @default - A unique name will be generated from the construct ID
   */
  readonly canaryName?: string;

  /**
   * Specify the runtime version to use for the canary.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_Library.html
   */
  readonly runtime: Runtime;

  /**
   * The type of test that you want your canary to run. Use `Test.custom()` to specify the test to run.
   */
  readonly test: Test;

  /**
   * Specifies whether this canary is to use active AWS X-Ray tracing when it runs.
   * Active tracing enables this canary run to be displayed in the ServiceLens and X-Ray service maps even if the
   * canary does not hit an endpoint that has X-Ray tracing enabled. Using X-Ray tracing incurs charges.
   *
   * You can enable active tracing only for canaries that use version `syn-nodejs-2.0` or later for their canary runtime.
   *
   * @default false
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_tracing.html
   */
  readonly activeTracing?: boolean;

  /**
   * Key-value pairs that the Synthetics caches and makes available for your canary scripts. Use environment variables
   * to apply configuration changes, such as test and production environment configurations, without changing your
   * Canary script source code.
   *
   * @default - No environment variables.
   */
  readonly environmentVariables?: { [key: string]: string };

  /**
   * The maximum amount of memory that the canary can use while running.
   * This value must be a multiple of 64 Mib.
   * The range is 960 MiB to 3008 MiB.
   *
   * @default Size.mebibytes(1024)
   */
  readonly memory?: cdk.Size;

  /**
   * How long the canary is allowed to run before it must stop.
   * You can't set this time to be longer than the frequency of the runs of this canary.
   *
   * The minimum allowed value is 3 seconds.
   * The maximum allowed value is 840 seconds (14 minutes).
   *
   * @default - the frequency of the canary is used as this value, up to a maximum of 900 seconds.
   */
  readonly timeout?: cdk.Duration;

  /**
   * The VPC where this canary is run.
   *
   * Specify this if the canary needs to access resources in a VPC.
   *
   * @default - Not in VPC
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Where to place the network interfaces within the VPC. You must provide `vpc` when using this prop.
   *
   * @default - the Vpc default strategy if not specified
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The list of security groups to associate with the canary's network interfaces. You must provide `vpc` when using this prop.
   *
   * @default - If the canary is placed within a VPC and a security group is
   * not specified a dedicated security group will be created for this canary.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * Specify the underlying resources to be cleaned up when the canary is deleted.
   * Using `Cleanup.LAMBDA` will create a Custom Resource to achieve this.
   *
   * @default Cleanup.NOTHING
   *
   * @deprecated use provisionedResourceCleanup
   */
  readonly cleanup?: Cleanup;

  /**
   * Whether to also delete the Lambda functions and layers used by this canary when the canary is deleted.
   *
   * @default undefined - the default behavior is to not delete the Lambda functions and layers
   */
  readonly provisionedResourceCleanup?: boolean;

  /**
   * Lifecycle rules for the generated canary artifact bucket. Has no effect
   * if a bucket is passed to `artifactsBucketLocation`. If you pass a bucket
   * to `artifactsBucketLocation`, you can add lifecycle rules to the bucket
   * itself.
   *
   * @default - no rules applied to the generated bucket.
   */
  readonly artifactsBucketLifecycleRules?: Array<s3.LifecycleRule>;

  /**
   * Canary Artifacts in S3 encryption mode.
   * Artifact encryption is only supported for canaries that use Synthetics runtime
   * version `syn-nodejs-puppeteer-3.3` or later.
   *
   * @default - Artifacts are encrypted at rest using an AWS managed key. `ArtifactsEncryptionMode.KMS` is set if you specify `artifactS3KmsKey`.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_artifact_encryption.html
   */
  readonly artifactS3EncryptionMode?: ArtifactsEncryptionMode;

  /**
   * The KMS key used to encrypt canary artifacts.
   *
   * @default - no kms key if `artifactS3EncryptionMode` is set to `S3_MANAGED`. A key will be created if one is not provided and `artifactS3EncryptionMode` is set to `KMS`.
   */
  readonly artifactS3KmsKey?: kms.IKey;

  /**
   * Specifies whether to perform a dry run before updating the canary.
   *
   * If set to true, CDK will execute a dry run to validate the changes before applying them to the canary.
   * If the dry run succeeds, the canary will be updated with the changes.
   * If the dry run fails, the CloudFormation deployment will fail with the dry run's failure reason.
   *
   * If set to false or omitted, the canary will be updated directly without first performing a dry run.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/performing-safe-canary-upgrades.html
   *
   * @default undefined - AWS CloudWatch default is false
   */
  readonly dryRunAndUpdate?: boolean;

  /**
   * Specifies which resources should have their tags replicated to this canary.
   *
   * To have the tags that you apply to this canary also be applied to the Lambda
   * function that the canary uses, specify this property with the value
   * ResourceToReplicateTags.LAMBDA_FUNCTION. If you do this, CloudWatch Synthetics will keep the tags of the canary and the
   * Lambda function synchronized. Any future changes you make to the canary's tags
   * will also be applied to the function.
   *
   * @default - No resources will have their tags replicated to this canary
   */
  readonly resourcesToReplicateTags?: ResourceToReplicateTags[];
}

/**
 * Encryption mode for canary artifacts.
 */
export enum ArtifactsEncryptionMode {
  /**
   * Server-side encryption (SSE) with an Amazon S3-managed key.
   */
  S3_MANAGED = 'SSE_S3',

  /**
   * Server-side encryption (SSE) with an AWS KMS customer managed key.
   */
  KMS = 'SSE_KMS',
}

/**
 * Define a new Canary
 */
@propertyInjectable
export class Canary extends cdk.Resource implements ec2.IConnectable {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-synthetics.Canary';

  /**
   * Execution role associated with this Canary.
   */
  public readonly role: iam.IRole;

  /**
   * The canary ID
   * @attribute
   */
  public readonly canaryId: string;

  /**
   * The state of the canary. For example, 'RUNNING', 'STOPPED', 'NOT STARTED', or 'ERROR'.
   * @attribute
   */
  public readonly canaryState: string;

  /**
   * The canary Name
   * @attribute
   */
  public readonly canaryName: string;

  /**
   * Bucket where data from each canary run is stored.
   */
  public readonly artifactsBucket: s3.IBucket;

  /**
   * Actual connections object for the underlying Lambda
   *
   * May be unset, in which case the canary Lambda is not configured for use in a VPC.
   * @internal
   */
  private readonly _connections?: ec2.Connections;
  private readonly _resource: CfnCanary;

  public constructor(scope: Construct, id: string, props: CanaryProps) {
    if (props.canaryName && !cdk.Token.isUnresolved(props.canaryName)) {
      validateName(props.canaryName);
    }

    super(scope, id, {
      physicalName: props.canaryName || cdk.Lazy.string({
        produce: () => this.generateUniqueName(),
      }),
    });
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    if (props.cleanup === Cleanup.LAMBDA && props.provisionedResourceCleanup) {
      throw new ValidationError('Cannot specify `provisionedResourceCleanup` when `cleanup` is set to `Cleanup.LAMBDA`. Use only `provisionedResourceCleanup`.', this);
    }

    this.artifactsBucket = props.artifactsBucketLocation?.bucket ?? new s3.Bucket(this, 'ArtifactsBucket', {
      encryption: s3.BucketEncryption.KMS_MANAGED,
      enforceSSL: true,
      lifecycleRules: props.artifactsBucketLifecycleRules,
    });

    this.role = props.role ?? this.createDefaultRole(props);

    if (props.vpc) {
      // Security Groups are created and/or appended in `createVpcConfig`.
      this._connections = new ec2.Connections({});
    }

    this.validateDryRunAndUpdate(props.runtime, props.dryRunAndUpdate);

    const resource: CfnCanary = new CfnCanary(this, 'Resource', {
      artifactS3Location: this.artifactsBucket.s3UrlForObject(props.artifactsBucketLocation?.prefix),
      executionRoleArn: this.role.roleArn,
      startCanaryAfterCreation: props.startAfterCreation ?? true,
      runtimeVersion: props.runtime.name,
      name: this.physicalName,
      schedule: this.createSchedule(props),
      failureRetentionPeriod: props.failureRetentionPeriod?.toDays(),
      successRetentionPeriod: props.successRetentionPeriod?.toDays(),
      code: this.createCode(props),
      runConfig: this.createRunConfig(props),
      vpcConfig: this.createVpcConfig(props),
      artifactConfig: this.createArtifactConfig(props),
      provisionedResourceCleanup: props.provisionedResourceCleanup !== undefined
        ? props.provisionedResourceCleanup
          ? 'AUTOMATIC'
          : 'OFF'
        : undefined,
      dryRunAndUpdate: props.dryRunAndUpdate,
      resourcesToReplicateTags: props.resourcesToReplicateTags,
    });
    this._resource = resource;

    this.canaryId = resource.attrId;
    this.canaryState = resource.attrState;
    this.canaryName = this.getResourceNameAttribute(resource.ref);

    if (props.cleanup === Cleanup.LAMBDA) {
      this.cleanupUnderlyingResources();
    }
  }

  private validateDryRunAndUpdate(runtime: Runtime, dryRunAndUpdate?: boolean) {
    const runtimeName = runtime.name;
    if (dryRunAndUpdate !== true || cdk.Token.isUnresolved(runtimeName)) {
      return;
    }

    const RUNTIME_REGEX = /^syn-(nodejs-puppeteer|nodejs-playwright|python-selenium)-(\d+\.\d+)$/;
    const MIN_SUPPORTED_VERSIONS: { [family: string]: number } = {
      'nodejs-puppeteer': 10.0,
      'nodejs-playwright': 2.0,
      'python-selenium': 5.1,
    };

    const match = runtimeName.match(RUNTIME_REGEX);

    if (!match || match.length < 3 || MIN_SUPPORTED_VERSIONS[match[1]] === undefined || parseFloat(match[2]) < MIN_SUPPORTED_VERSIONS[match[1]]) {
      throw new ValidationError(`dryRunAndUpdate is only supported for canary runtime versions 'syn-nodejs-puppeteer-10.0+', 'syn-nodejs-playwright-2.0+', or 'syn-python-selenium-5.1+', got: ${runtimeName}`, this);
    }
  }

  private cleanupUnderlyingResources() {
    const provider = AutoDeleteUnderlyingResourcesProvider.getOrCreateProvider(this, AUTO_DELETE_UNDERLYING_RESOURCES_RESOURCE_TYPE, {
      useCfnResponseWrapper: false,
      description: `Lambda function for auto-deleting underlying resources created by ${this.canaryName}.`,
      policyStatements: [{
        Effect: 'Allow',
        Action: ['lambda:DeleteFunction'],
        Resource: this.lambdaArn(),
      }, {
        Effect: 'Allow',
        Action: ['synthetics:GetCanary'],
        Resource: '*',
      }],
    });

    new cdk.CustomResource(this, 'AutoDeleteUnderlyingResourcesCustomResource', {
      resourceType: AUTO_DELETE_UNDERLYING_RESOURCES_RESOURCE_TYPE,
      serviceToken: provider.serviceToken,
      properties: {
        CanaryName: this.canaryName,
      },
    });

    // We also tag the canary to record the fact that we want it autodeleted.
    // The custom resource will check this tag before actually doing the delete.
    // Because tagging and untagging will ALWAYS happen before the CR is deleted,
    // we can set `autoDeleteLambda: false` without the removal of the CR emptying
    // the lambda as a side effect.
    cdk.Tags.of(this._resource).add(AUTO_DELETE_UNDERLYING_RESOURCES_TAG, 'true');
  }

  /**
   * Access the Connections object
   *
   * Will fail if not a VPC-enabled Canary
   */
  public get connections(): ec2.Connections {
    if (!this._connections) {
      // eslint-disable-next-line max-len
      throw new ValidationError('Only VPC-associated Canaries have security groups to manage. Supply the "vpc" parameter when creating the Canary.', this);
    }
    return this._connections;
  }

  /**
   * Measure the Duration of a single canary run, in seconds.
   *
   * @param options - configuration options for the metric
   *
   * @default avg over 5 minutes
   */
  @MethodMetadata()
  public metricDuration(options?: MetricOptions): Metric {
    return new Metric({
      ...CloudWatchSyntheticsMetrics.durationMaximum({ CanaryName: this.canaryName }),
      ...{ statistic: 'Average' },
      ...options,
    }).attachTo(this);
  }

  /**
   * Measure the percentage of successful canary runs.
   *
   * @param options - configuration options for the metric
   *
   * @default avg over 5 minutes
   */
  @MethodMetadata()
  public metricSuccessPercent(options?: MetricOptions): Metric {
    return this.cannedMetric(CloudWatchSyntheticsMetrics.successPercentAverage, options);
  }

  /**
   * Measure the number of failed canary runs over a given time period.
   *
   * Default: sum over 5 minutes
   *
   * @param options - configuration options for the metric
   */
  @MethodMetadata()
  public metricFailed(options?: MetricOptions): Metric {
    return this.cannedMetric(CloudWatchSyntheticsMetrics.failedSum, options);
  }

  /**
   * Returns a default role for the canary
   */
  private createDefaultRole(props: CanaryProps): iam.IRole {
    const prefix = props.artifactsBucketLocation?.prefix;

    // Created role will need these policies to run the Canary.
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-synthetics-canary.html#cfn-synthetics-canary-executionrolearn
    const policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['s3:ListAllMyBuckets'],
        }),
        new iam.PolicyStatement({
          resources: [this.artifactsBucket.bucketArn],
          actions: ['s3:GetBucketLocation'],
        }),
        new iam.PolicyStatement({
          resources: [this.artifactsBucket.arnForObjects(`${prefix ? prefix + '/*' : '*'}`)],
          actions: ['s3:PutObject'],
        }),
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['cloudwatch:PutMetricData'],
          conditions: { StringEquals: { 'cloudwatch:namespace': 'CloudWatchSynthetics' } },
        }),
        new iam.PolicyStatement({
          resources: [this.logGroupArn()],
          actions: ['logs:CreateLogStream', 'logs:CreateLogGroup', 'logs:PutLogEvents'],
        }),
      ],
    });

    const managedPolicies: iam.IManagedPolicy[] = [];

    if (props.vpc) {
      // Policy that will have ENI creation permissions
      managedPolicies.push(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
    }

    return new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        canaryPolicy: policy,
      },
      managedPolicies,
    });
  }

  private logGroupArn() {
    return cdk.Stack.of(this).formatArn({
      service: 'logs',
      resource: 'log-group',
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
      resourceName: '/aws/lambda/cwsyn-*',
    });
  }

  private lambdaArn() {
    return cdk.Stack.of(this).formatArn({
      service: 'lambda',
      resource: 'function',
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
      resourceName: 'cwsyn-*',
    });
  }

  /**
   * Returns the code object taken in by the canary resource.
   */
  private createCode(props: CanaryProps): CfnCanary.CodeProperty {
    this.validateHandler(props.test.handler, props.runtime);
    const codeConfig = {
      handler: props.test.handler,
      ...props.test.code.bind(this, props.test.handler, props.runtime.family, props.runtime.name),
    };
    return {
      handler: codeConfig.handler,
      script: codeConfig.inlineCode,
      s3Bucket: codeConfig.s3Location?.bucketName,
      s3Key: codeConfig.s3Location?.objectKey,
      s3ObjectVersion: codeConfig.s3Location?.objectVersion,
    };
  }

  /**
   * Verifies that the handler name matches the conventions given a certain runtime.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-synthetics-canary-code.html#cfn-synthetics-canary-code-handler
   * @param handler - the name of the handler
   * @param runtime - the runtime version
   */
  private validateHandler(handler: string, runtime: Runtime) {
    const oldRuntimes = [
      Runtime.SYNTHETICS_PYTHON_SELENIUM_1_0,
    ];
    if (oldRuntimes.includes(runtime)) {
      if (!handler.match(/^[0-9A-Za-z_\\-]+\.handler*$/)) {
        throw new ValidationError(`Canary Handler must be specified as \'fileName.handler\' for legacy runtimes, received ${handler}`, this);
      }
    } else {
      if (!handler.match(/^([0-9a-zA-Z_-]+\/)*[0-9A-Za-z_\\-]+\.[A-Za-z_][A-Za-z0-9_]*$/)) {
        throw new ValidationError(`Canary Handler must be specified either as \'fileName.handler\', \'fileName.functionName\', or \'folder/fileName.functionName\', received ${handler}`, this);
      }
    }
    if (handler.length < 1 || handler.length > 128) {
      throw new ValidationError(`Canary Handler length must be between 1 and 128, received ${handler.length}`, this);
    }
  }

  private createRunConfig(props: CanaryProps): CfnCanary.RunConfigProperty | undefined {
    if (props.activeTracing === undefined &&
      !props.environmentVariables &&
      !props.memory &&
      !props.timeout) {
      return undefined;
    }

    if (
      props.activeTracing &&
      (
        // Only check runtime family is nodejs because versions prior to syn-nodejs-2.0 are deprecated and can no longer be configured.
        (!cdk.Token.isUnresolved(props.runtime.family) && props.runtime.family !== RuntimeFamily.NODEJS) ||
        (!cdk.Token.isUnresolved(props.runtime.name) && props.runtime.name.includes('playwright'))
      )
    ) {
      throw new ValidationError(`You can only enable active tracing for canaries that use canary runtime version 'syn-nodejs-2.0' or later and are not using the Playwright runtime, got ${props.runtime.name}.`, this);
    }

    let memoryInMb: number | undefined;
    if (!cdk.Token.isUnresolved(props.memory) && props.memory !== undefined) {
      memoryInMb = props.memory.toMebibytes();
      if (memoryInMb % 64 !== 0) {
        throw new ValidationError(`\`memory\` must be a multiple of 64 MiB, got ${memoryInMb} MiB.`, this);
      }
      if (memoryInMb < 960 || memoryInMb > 3008) {
        throw new ValidationError(`\`memory\` must be between 960 MiB and 3008 MiB, got ${memoryInMb} MiB.`, this);
      }
    }

    let timeoutInSeconds: number | undefined;
    if (!cdk.Token.isUnresolved(props.timeout) && props.timeout !== undefined) {
      const timeoutInMillis = props.timeout.toMilliseconds();
      if (timeoutInMillis % 1000 !== 0) {
        throw new ValidationError(`\`timeout\` must be set as an integer representing seconds, got ${timeoutInMillis} milliseconds.`, this);
      }

      timeoutInSeconds = props.timeout.toSeconds();
      if (timeoutInSeconds < 3 || timeoutInSeconds > 840) {
        throw new ValidationError(`\`timeout\` must be between 3 seconds and 840 seconds, got ${timeoutInSeconds} seconds.`, this);
      }
    }

    return {
      activeTracing: props.activeTracing,
      environmentVariables: props.environmentVariables,
      memoryInMb,
      timeoutInSeconds,
    };
  }

  /**
   * Returns a canary schedule object
   */
  private createSchedule(props: CanaryProps): CfnCanary.ScheduleProperty {
    return {
      durationInSeconds: String(`${props.timeToLive?.toSeconds() ?? 0}`),
      expression: props.schedule?.expressionString ?? 'rate(5 minutes)',
      retryConfig: props.maxRetries ? {
        maxRetries: props.maxRetries,
      } : undefined,
    };
  }

  private createVpcConfig(props: CanaryProps): CfnCanary.VPCConfigProperty | undefined {
    if (!props.vpc) {
      if (props.vpcSubnets != null || props.securityGroups != null) {
        throw new ValidationError("You must provide the 'vpc' prop when using VPC-related properties.", this);
      }

      return undefined;
    }

    const { subnetIds } = props.vpc.selectSubnets(props.vpcSubnets);
    if (subnetIds.length < 1) {
      throw new ValidationError('No matching subnets found in the VPC.', this);
    }

    let securityGroups: ec2.ISecurityGroup[];
    if (props.securityGroups && props.securityGroups.length > 0) {
      securityGroups = props.securityGroups;
    } else {
      const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc,
        description: 'Automatic security group for Canary ' + cdk.Names.uniqueId(this),
      });
      securityGroups = [securityGroup];
    }
    this._connections!.addSecurityGroup(...securityGroups);

    return {
      vpcId: props.vpc.vpcId,
      subnetIds,
      securityGroupIds: cdk.Lazy.list({ produce: () => this.connections.securityGroups.map(sg => sg.securityGroupId) }),
    };
  }

  private createArtifactConfig(props: CanaryProps): CfnCanary.ArtifactConfigProperty | undefined {
    if (!props.artifactS3EncryptionMode && !props.artifactS3KmsKey) {
      return undefined;
    }

    const isNodeRuntime = props.runtime.family === RuntimeFamily.NODEJS;

    if (
      props.artifactS3EncryptionMode === ArtifactsEncryptionMode.S3_MANAGED &&
      props.artifactS3KmsKey
    ) {
      throw new ValidationError(`A customer-managed KMS key was provided, but the encryption mode is not set to SSE-KMS, got: ${props.artifactS3EncryptionMode}.`, this);
    }

    // Only check runtime family is Node.js because versions prior to `syn-nodejs-puppeteer-3.3` are deprecated and can no longer be configured.
    if (!isNodeRuntime && props.artifactS3EncryptionMode) {
      throw new ValidationError(`Artifact encryption is only supported for canaries that use Synthetics runtime version \`syn-nodejs-puppeteer-3.3\` or later and the Playwright runtime, got ${props.runtime.name}.`, this);
    }

    const encryptionMode = props.artifactS3EncryptionMode ? props.artifactS3EncryptionMode :
      props.artifactS3KmsKey ? ArtifactsEncryptionMode.KMS : undefined;

    let encryptionKey: kms.IKey | undefined;
    if (encryptionMode === ArtifactsEncryptionMode.KMS) {
      encryptionKey = props.artifactS3KmsKey ?? new kms.Key(this, 'Key', { description: `Created by ${this.node.path}` });
    }

    encryptionKey?.grantEncryptDecrypt(this.role);

    return {
      s3Encryption: {
        encryptionMode,
        kmsKeyArn: encryptionKey?.keyArn,
      },
    };
  }

  /**
   * Creates a unique name for the canary. The generated name is the physical ID of the canary.
   */
  private generateUniqueName(): string {
    const name = cdk.Names.uniqueId(this).toLowerCase().replace(' ', '-');
    if (name.length <= 21) {
      return name;
    } else {
      return name.substring(0, 15) + nameHash(name);
    }
  }

  private cannedMetric(
    fn: (dims: { CanaryName: string }) => MetricProps,
    props?: MetricOptions): Metric {
    return new Metric({
      ...fn({ CanaryName: this.canaryName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * Take a hash of the given name.
 *
 * @param name the name to be hashed
 */
function nameHash(name: string): string {
  const md5 = crypto.createHash('sha256').update(name).digest('hex');
  return md5.slice(0, 6);
}

const nameRegex: RegExp = /^[0-9a-z_\-]+$/;

/**
 * Verifies that the name fits the regex expression: ^[0-9a-z_\-]+$.
 *
 * @param name - the given name of the canary
 */
function validateName(name: string) {
  if (name.length > 255) {
    throw new UnscopedValidationError(`Canary name is too large, must be between 1 and 255 characters, but is ${name.length} (got "${name}")`);
  }
  if (!nameRegex.test(name)) {
    throw new UnscopedValidationError(`Canary name must be lowercase, numbers, hyphens, or underscores (got "${name}")`);
  }
}
