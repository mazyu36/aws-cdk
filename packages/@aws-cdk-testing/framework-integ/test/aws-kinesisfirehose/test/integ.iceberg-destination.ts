#!/usr/bin/env node
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { IntegTest } from '@aws-cdk/integ-tests-alpha';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-firehose-iceberg-destination');

// Create S3 bucket for Iceberg table data
const bucket = new s3.Bucket(stack, 'IcebergDataBucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

// Create Glue database for Iceberg tables
const database = new glue.CfnDatabase(stack, 'IcebergDatabase', {
  catalogId: cdk.Aws.ACCOUNT_ID,
  databaseInput: {
    name: 'iceberg_test_database',
    description: 'Test database for Iceberg integration test',
  },
});

// Test 1: Minimal Iceberg destination configuration
const minimalDeliveryStream = new firehose.DeliveryStream(stack, 'MinimalIcebergDeliveryStream', {
  destination: new firehose.IcebergDestination({
    catalogConfiguration: {
      catalogArn: `arn:${cdk.Aws.PARTITION}:glue:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:catalog`,
    },
    s3Configuration: {
      bucket,
    },
  }),
});

// Test 2: Full Iceberg destination configuration with all features
const fullDeliveryStream = new firehose.DeliveryStream(stack, 'FullIcebergDeliveryStream', {
  destination: new firehose.IcebergDestination({
    catalogConfiguration: {
      catalogArn: `arn:${cdk.Aws.PARTITION}:glue:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:catalog`,
      warehouseLocation: `s3://${bucket.bucketName}/warehouse/`,
    },
    s3Configuration: {
      bucket,
      bufferingInterval: cdk.Duration.seconds(120),
      bufferingSize: cdk.Size.mebibytes(10),
      prefix: 'iceberg-data/',
      errorOutputPrefix: 'iceberg-errors/',
    },
    appendOnly: true,
    destinationTableConfigurationList: [
      {
        tableName: 'test_table',
        databaseName: 'iceberg_test_database',
        uniqueKeys: ['id', 'timestamp'],
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
      duration: cdk.Duration.hours(12),
    },
  }),
});

// Output delivery stream names for testing
new cdk.CfnOutput(stack, 'MinimalDeliveryStreamName', {
  value: minimalDeliveryStream.deliveryStreamName,
  description: 'Name of the minimal Iceberg delivery stream',
});

new cdk.CfnOutput(stack, 'FullDeliveryStreamName', {
  value: fullDeliveryStream.deliveryStreamName,
  description: 'Name of the full-featured Iceberg delivery stream',
});

new cdk.CfnOutput(stack, 'IcebergDataBucketName', {
  value: bucket.bucketName,
  description: 'Name of the S3 bucket for Iceberg data',
});

new cdk.CfnOutput(stack, 'GlueDatabaseName', {
  value: database.ref,
  description: 'Name of the Glue database for Iceberg tables',
});

// Create integration test
new IntegTest(app, 'IcebergDestinationIntegTest', {
  testCases: [stack],
  regions: ['us-east-1'], // Iceberg is supported in us-east-1
  cdkCommandOptions: {
    deploy: {
      args: {
        rollback: false,
      },
    },
  },
});