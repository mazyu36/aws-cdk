import { App, Stack } from 'aws-cdk-lib';
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Queue } from 'aws-cdk-lib/aws-sqs';

const app = new App();
const stack = new Stack(app, 'Stack');
const deadLetterQueue = new Queue(stack, 'DeadLetterQueue');

new EventBus(stack, 'Bus', {
  deadLetterQueue,
});

new IntegTest(app, 'IntegTest-EventBusStack', {
  testCases: [stack],
});
