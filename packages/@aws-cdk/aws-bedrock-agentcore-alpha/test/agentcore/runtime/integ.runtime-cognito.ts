import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as integ from '@aws-cdk/integ-tests-alpha';
import * as agentcore from '../../../agentcore';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-bedrock-agentcore-runtime-cognito');

const userPool = new cognito.UserPool(stack, 'MyUserPool', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const userPoolClient = userPool.addClient('MyUserPoolClient', {
  authFlows: {
    adminUserPassword: true,
  },
});

const anotherUserPoolClient = userPool.addClient('MyAnotherUserPoolClient', {
  authFlows: {
    adminUserPassword: true,
  },
});

const runtimeArtifact = agentcore.AgentRuntimeArtifact.fromAsset(
  path.join(__dirname, 'testArtifact'),
);

// Create a single runtime (similar to the working strands example)
const runtime = new agentcore.Runtime(stack, 'TestRuntime', {
  runtimeName: 'integ_test_runtime_cognito',
  agentRuntimeArtifact: runtimeArtifact,
  networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
  authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(userPool, [userPoolClient, anotherUserPoolClient]),
});

// Output runtime and endpoint information for verification
new cdk.CfnOutput(stack, 'RuntimeId', {
  value: runtime.agentRuntimeId,
  description: 'Runtime ID',
});

new cdk.CfnOutput(stack, 'RuntimeArn', {
  value: runtime.agentRuntimeArn,
  description: 'Runtime ARN',
});

// Output Cognito information for authentication tests
new cdk.CfnOutput(stack, 'UserPoolId', {
  value: userPool.userPoolId,
  description: 'Cognito User Pool ID',
});

new cdk.CfnOutput(stack, 'UserPoolClientId1', {
  value: userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID 1 (MyUserPoolClient)',
});

new cdk.CfnOutput(stack, 'UserPoolClientId2', {
  value: anotherUserPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID 2 (MyAnotherUserPoolClient)',
});

// Create the integration test
new integ.IntegTest(app, 'BedrockAgentCoreRuntimeCognitoTest', {
  testCases: [stack],
});
