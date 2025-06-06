import { App, Stack } from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as integ from '@aws-cdk/integ-tests-alpha';
import { getClusterVersionConfig } from './integ-tests-kubernetes-version';

class EksClusterStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', { natGateways: 1 });
    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc,
      ...getClusterVersionConfig(this, eks.KubernetesVersion.V1_32),
    });

    new eks.Addon(this, 'Addon', {
      addonName: 'coredns',
      cluster,
      preserveOnDelete: true,
      configurationValues: {
        replicaCount: 2,
      },
    });
  }
}

const app = new App({
  postCliContext: {
    '@aws-cdk/aws-lambda:useCdkManagedLogGroup': false,
    '@aws-cdk/aws-lambda:createNewPoliciesWithAddToRolePolicy': false,
  },
});

const stack = new EksClusterStack(app, 'EksClusterWithAddonStack');
new integ.IntegTest(app, 'EksClusterwithAddon', {
  testCases: [stack],
});
