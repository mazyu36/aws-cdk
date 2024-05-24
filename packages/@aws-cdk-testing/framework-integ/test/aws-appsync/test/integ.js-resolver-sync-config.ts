import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cdk from 'aws-cdk-lib';
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import * as appsync from 'aws-cdk-lib/aws-appsync';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'AppSyncJsResolverTestSyncConfigStack');

const logConfig: appsync.LogConfig = {
  retention: logs.RetentionDays.ONE_WEEK,
};

const api = new appsync.GraphqlApi(stack, 'JsResolverApi', {
  name: 'JsResolverApi',
  schema: appsync.SchemaFile.fromAsset(path.join(__dirname, 'appsync.js-resolver.graphql')),
  logConfig,
});

const db = new dynamodb.Table(stack, 'DynamoTable', {
  partitionKey: {
    name: 'id',
    type: dynamodb.AttributeType.STRING,
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const dataSource = api.addDynamoDbDataSource('DynamoDataSource', db,{
  deltaSyncConfig:{

  }
});

const dummyHandler = new lambda.Function(stack, 'DefaultHandler', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: new lambda.InlineCode('exports.handler = async function(event, context) { console.log(event); return { statusCode: 200, body: "default" }; };'),
});

const addTestFunc = dataSource.createFunction('AddTestFunction', {
  name: 'addTestFunc',
  runtime: appsync.FunctionRuntime.JS_1_0_0,
  code: appsync.Code.fromAsset(path.join(
    __dirname,
    'integ-assets',
    'appsync-js-resolver.js',
  )),
  syncConfig: new appsync.SyncConfig({
    conflictDetection: appsync.ConflictDetection.VERSION,
    conflictHandler: appsync.ConflictHandler.LAMBDA,
    lambdaConflictHandler: dummyHandler,
  }),
});

new appsync.Resolver(stack, 'AddTestResolver', {
  api,
  typeName: 'Mutation',
  fieldName: 'addTest',
  code: appsync.Code.fromAsset(path.join(
    __dirname,
    'integ-assets',
    'appsync-js-pipeline.js',
  )),
  runtime: appsync.FunctionRuntime.JS_1_0_0,
  pipelineConfig: [addTestFunc],
  syncConfig: new appsync.SyncConfig({
    conflictDetection: appsync.ConflictDetection.VERSION,
    conflictHandler: appsync.ConflictHandler.LAMBDA,
    lambdaConflictHandler: dummyHandler,
  }),
});

new IntegTest(app, 'AppSyncJsResolverTestSyncConfigTest', {
  testCases: [stack],
});

app.synth();
