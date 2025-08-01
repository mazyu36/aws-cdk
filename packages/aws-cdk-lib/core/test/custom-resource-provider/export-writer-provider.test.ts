import { App, Stack, AssetStaging, CfnResource, NestedStack } from '../../lib';
import { ExportWriter } from '../../lib/custom-resource-provider/cross-region-export-providers/export-writer-provider';
import { toCloudFormation } from '../util';

describe('export writer provider', () => {
  const latestNodeRuntimeMap = {
    Mappings: {
      LatestNodeRuntimeMap: {
        'af-south-1': {
          value: 'nodejs22.x',
        },
        'ap-east-1': {
          value: 'nodejs22.x',
        },
        'ap-northeast-1': {
          value: 'nodejs22.x',
        },
        'ap-northeast-2': {
          value: 'nodejs22.x',
        },
        'ap-northeast-3': {
          value: 'nodejs22.x',
        },
        'ap-south-1': {
          value: 'nodejs22.x',
        },
        'ap-south-2': {
          value: 'nodejs22.x',
        },
        'ap-southeast-1': {
          value: 'nodejs22.x',
        },
        'ap-southeast-2': {
          value: 'nodejs22.x',
        },
        'ap-southeast-3': {
          value: 'nodejs22.x',
        },
        'ap-southeast-4': {
          value: 'nodejs22.x',
        },
        'ap-southeast-5': {
          value: 'nodejs22.x',
        },
        'ap-southeast-6': {
          value: 'nodejs22.x',
        },
        'ap-southeast-7': {
          value: 'nodejs22.x',
        },
        'ca-central-1': {
          value: 'nodejs22.x',
        },
        'ca-west-1': {
          value: 'nodejs22.x',
        },
        'cn-north-1': {
          value: 'nodejs22.x',
        },
        'cn-northwest-1': {
          value: 'nodejs22.x',
        },
        'eu-central-1': {
          value: 'nodejs22.x',
        },
        'eu-central-2': {
          value: 'nodejs22.x',
        },
        'eu-isoe-west-1': {
          value: 'nodejs18.x',
        },
        'eu-north-1': {
          value: 'nodejs22.x',
        },
        'eu-south-1': {
          value: 'nodejs22.x',
        },
        'eu-south-2': {
          value: 'nodejs22.x',
        },
        'eu-west-1': {
          value: 'nodejs22.x',
        },
        'eu-west-2': {
          value: 'nodejs22.x',
        },
        'eu-west-3': {
          value: 'nodejs22.x',
        },
        'il-central-1': {
          value: 'nodejs22.x',
        },
        'me-central-1': {
          value: 'nodejs22.x',
        },
        'me-south-1': {
          value: 'nodejs22.x',
        },
        'mx-central-1': {
          value: 'nodejs22.x',
        },
        'sa-east-1': {
          value: 'nodejs22.x',
        },
        'us-east-1': {
          value: 'nodejs22.x',
        },
        'us-east-2': {
          value: 'nodejs22.x',
        },
        'us-gov-east-1': {
          value: 'nodejs22.x',
        },
        'us-gov-west-1': {
          value: 'nodejs22.x',
        },
        'us-iso-east-1': {
          value: 'nodejs18.x',
        },
        'us-iso-west-1': {
          value: 'nodejs18.x',
        },
        'us-isob-east-1': {
          value: 'nodejs18.x',
        },
        'us-isob-west-1': {
          value: 'nodejs18.x',
        },
        'us-west-1': {
          value: 'nodejs22.x',
        },
        'us-west-2': {
          value: 'nodejs22.x',
        },
        'ap-east-2': {
          value: 'nodejs22.x',
        },
        'eusc-de-east-1': {
          value: 'nodejs22.x',
        },
      },
    },
  };

  test('basic configuration', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'Stack1');
    const stack2 = new Stack(app, 'Stack2');
    const resource = new CfnResource(stack, 'MyResource', {
      type: 'Custom::MyResource',
    });

    // WHEN
    const exportWriter = new ExportWriter(stack, 'ExportWriter', {
      region: 'us-east-1',
    });
    const exportValue = exportWriter.exportValue('MyResourceName', resource.getAtt('arn'), stack2);

    // THEN
    const cfn = toCloudFormation(stack);
    const stack2Cfn = toCloudFormation(stack2);
    const staging = stack.node.tryFindChild('Custom::CrossRegionExportWriterCustomResourceProvider')?.node.tryFindChild('Staging') as AssetStaging;
    const assetHash = staging.assetHash;

    expect(stack.resolve(exportValue)).toEqual({
      'Fn::GetAtt': [
        'ExportsReader8B249524',
        '/cdk/exports/MyResourceName',
      ],
    });
    expect(cfn).toEqual({
      Mappings: latestNodeRuntimeMap.Mappings,
      Resources: {
        MyResource: {
          Type: 'Custom::MyResource',
        },
        CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1: {
          Type: 'AWS::IAM::Role',
          Properties: {
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com',
                  },
                },
              ],
            },
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'ssm:DeleteParameters',
                        'ssm:ListTagsForResource',
                        'ssm:GetParameters',
                        'ssm:PutParameter',
                      ],
                      Effect: 'Allow',
                      Resource: [{
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              Ref: 'AWS::Partition',
                            },
                            ':ssm:us-east-1:',
                            {
                              Ref: 'AWS::AccountId',
                            },
                            ':parameter/cdk/exports/*',
                          ],
                        ],
                      }],
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'Inline',
              },
            ],
            ManagedPolicyArns: [
              {
                'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              },
            ],
          },
        },
        ExportWriterA770449C: {
          DeletionPolicy: 'Delete',
          Properties: {
            WriterProps: {
              region: 'us-east-1',
              exports: {
                '/cdk/exports/MyResourceName': {
                  'Fn::GetAtt': [
                    'MyResource',
                    'arn',
                  ],
                },
              },
            },
            ServiceToken: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportWriterCustomResourceProviderHandlerD8786E8A',
                'Arn',
              ],
            },
          },
          Type: 'Custom::CrossRegionExportWriter',
          UpdateReplacePolicy: 'Delete',
        },
        CustomCrossRegionExportWriterCustomResourceProviderHandlerD8786E8A: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Code: {
              S3Bucket: {
                'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
              },
              S3Key: `${assetHash}.zip`,
            },
            Timeout: 900,
            MemorySize: 128,
            Handler: '__entrypoint__.handler',
            Role: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1',
                'Arn',
              ],
            },
            Runtime: {
              'Fn::FindInMap': [
                'LatestNodeRuntimeMap',
                {
                  Ref: 'AWS::Region',
                },
                'value',
              ],
            },
          },
          DependsOn: [
            'CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1',
          ],
        },
      },
    });
    expect(stack2Cfn).toEqual({
      Mappings: latestNodeRuntimeMap.Mappings,
      Resources: {
        CustomCrossRegionExportReaderCustomResourceProviderHandler46647B68: {
          DependsOn: [
            'CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD',
          ],
          Properties: {
            Code: {
              S3Bucket: {
                'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
              },
              S3Key: expect.any(String),
            },
            Handler: '__entrypoint__.handler',
            MemorySize: 128,
            Role: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD',
                'Arn',
              ],
            },
            Runtime: {
              'Fn::FindInMap': [
                'LatestNodeRuntimeMap',
                {
                  Ref: 'AWS::Region',
                },
                'value',
              ],
            },
            Timeout: 900,
          },
          Type: 'AWS::Lambda::Function',
        },
        CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD: {
          Properties: {
            AssumeRolePolicyDocument: {
              Statement: [
                {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com',
                  },
                },
              ],
              Version: '2012-10-17',
            },
            ManagedPolicyArns: [
              {
                'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              },
            ],
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'ssm:AddTagsToResource',
                        'ssm:RemoveTagsFromResource',
                        'ssm:GetParameters',
                      ],
                      Effect: 'Allow',
                      Resource: {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              Ref: 'AWS::Partition',
                            },
                            ':ssm:',
                            {
                              Ref: 'AWS::Region',
                            },
                            ':',
                            {
                              Ref: 'AWS::AccountId',
                            },
                            ':parameter/cdk/exports/Stack2/*',
                          ],
                        ],
                      },
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'Inline',
              },
            ],
          },
          Type: 'AWS::IAM::Role',
        },
        ExportsReader8B249524: {
          DeletionPolicy: 'Delete',
          Properties: {
            ReaderProps: {
              imports: {
                '/cdk/exports/MyResourceName': '{{resolve:ssm:/cdk/exports/MyResourceName}}',
              },
              region: {
                Ref: 'AWS::Region',
              },
              prefix: 'Stack2',
            },
            ServiceToken: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportReaderCustomResourceProviderHandler46647B68',
                'Arn',
              ],
            },
          },
          Type: 'Custom::CrossRegionExportReader',
          UpdateReplacePolicy: 'Delete',
        },
      },
    });
  });

  test('multi region', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'Stack1', { env: { region: 'producer-region' } });
    const stack2 = new Stack(app, 'Stack2', { env: { region: 'consumer-region1' }, crossRegionReferences: true });
    const stack3 = new Stack(app, 'Stack3', { env: { region: 'consumer-region2' }, crossRegionReferences: true });

    // WHEN
    const resource = new CfnResource(stack, 'MyResource', {
      type: 'Custom::MyResource',
    });
    new CfnResource(stack2, 'MyResource', {
      type: 'Custom::MyResource',
      properties: {
        Prop: resource.getAtt('arn'),
      },
    });
    new CfnResource(stack3, 'MyResource', {
      type: 'Custom::MyResource',
      properties: {
        Prop: resource.getAtt('arn'),
      },
    });

    // THEN
    app.synth();
    const cfn = toCloudFormation(stack);
    expect(cfn).toMatchObject({
      Resources: {
        MyResource: {
          Type: 'Custom::MyResource',
        },
        CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1: {
          Type: 'AWS::IAM::Role',
          Properties: {
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com',
                  },
                },
              ],
            },
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'ssm:DeleteParameters',
                        'ssm:ListTagsForResource',
                        'ssm:GetParameters',
                        'ssm:PutParameter',
                      ],
                      Effect: 'Allow',
                      Resource: [
                        {
                          'Fn::Join': [
                            '',
                            [
                              'arn:',
                              {
                                Ref: 'AWS::Partition',
                              },
                              ':ssm:consumer-region1:',
                              {
                                Ref: 'AWS::AccountId',
                              },
                              ':parameter/cdk/exports/*',
                            ],
                          ],
                        },
                        {
                          'Fn::Join': [
                            '',
                            [
                              'arn:',
                              {
                                Ref: 'AWS::Partition',
                              },
                              ':ssm:consumer-region2:',
                              {
                                Ref: 'AWS::AccountId',
                              },
                              ':parameter/cdk/exports/*',
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'Inline',
              },
            ],
            ManagedPolicyArns: [
              {
                'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              },
            ],
          },
        },
      },
    });
  });

  test('when consumer is a nested stack, ExportReader is created in the parent stack', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'Stack1');
    const stack2 = new Stack(app, 'Stack2');
    const nested2 = new NestedStack(stack2, 'Nested1');
    const resource = new CfnResource(stack, 'MyResource', {
      type: 'Custom::MyResource',
    });

    // WHEN
    const exportWriter = new ExportWriter(stack, 'ExportWriter', {
      region: 'us-east-1',
    });
    const exportValue = exportWriter.exportValue('MyResourceName', resource.getAtt('arn'), nested2);

    // THEN
    const cfn = toCloudFormation(stack);
    const stack2Cfn = toCloudFormation(stack2);
    const staging = stack.node.tryFindChild('Custom::CrossRegionExportWriterCustomResourceProvider')?.node.tryFindChild('Staging') as AssetStaging;
    const assetHash = staging.assetHash;

    expect(stack.resolve(exportValue)).toEqual({
      'Fn::GetAtt': ['ExportsReader8B249524', '/cdk/exports/MyResourceName'],
    });
    expect(cfn).toEqual({
      Mappings: latestNodeRuntimeMap.Mappings,
      Resources: {
        MyResource: {
          Type: 'Custom::MyResource',
        },
        CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1: {
          Type: 'AWS::IAM::Role',
          Properties: {
            AssumeRolePolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com',
                  },
                },
              ],
            },
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'ssm:DeleteParameters',
                        'ssm:ListTagsForResource',
                        'ssm:GetParameters',
                        'ssm:PutParameter',
                      ],
                      Effect: 'Allow',
                      Resource: [{
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              Ref: 'AWS::Partition',
                            },
                            ':ssm:us-east-1:',
                            {
                              Ref: 'AWS::AccountId',
                            },
                            ':parameter/cdk/exports/*',
                          ],
                        ],
                      }],
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'Inline',
              },
            ],
            ManagedPolicyArns: [
              {
                'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              },
            ],
          },
        },
        ExportWriterA770449C: {
          DeletionPolicy: 'Delete',
          Properties: {
            WriterProps: {
              region: 'us-east-1',
              exports: {
                '/cdk/exports/MyResourceName': {
                  'Fn::GetAtt': [
                    'MyResource',
                    'arn',
                  ],
                },
              },

            },
            ServiceToken: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportWriterCustomResourceProviderHandlerD8786E8A',
                'Arn',
              ],
            },
          },
          Type: 'Custom::CrossRegionExportWriter',
          UpdateReplacePolicy: 'Delete',
        },
        CustomCrossRegionExportWriterCustomResourceProviderHandlerD8786E8A: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            Code: {
              S3Bucket: {
                'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
              },
              S3Key: `${assetHash}.zip`,
            },
            Timeout: 900,
            MemorySize: 128,
            Handler: '__entrypoint__.handler',
            Role: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1',
                'Arn',
              ],
            },
            Runtime: {
              'Fn::FindInMap': [
                'LatestNodeRuntimeMap',
                {
                  Ref: 'AWS::Region',
                },
                'value',
              ],
            },
          },
          DependsOn: [
            'CustomCrossRegionExportWriterCustomResourceProviderRoleC951B1E1',
          ],
        },
      },
    });
    expect(stack2Cfn).toEqual({
      Mappings: latestNodeRuntimeMap.Mappings,
      Resources: {
        CustomCrossRegionExportReaderCustomResourceProviderHandler46647B68: {
          DependsOn: [
            'CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD',
          ],
          Properties: {
            Code: {
              S3Bucket: {
                'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
              },
              S3Key: expect.any(String),
            },
            Handler: '__entrypoint__.handler',
            MemorySize: 128,
            Role: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD',
                'Arn',
              ],
            },
            Runtime: {
              'Fn::FindInMap': [
                'LatestNodeRuntimeMap',
                {
                  Ref: 'AWS::Region',
                },
                'value',
              ],
            },
            Timeout: 900,
          },
          Type: 'AWS::Lambda::Function',
        },
        CustomCrossRegionExportReaderCustomResourceProviderRole10531BBD: {
          Properties: {
            AssumeRolePolicyDocument: {
              Statement: [
                {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                    Service: 'lambda.amazonaws.com',
                  },
                },
              ],
              Version: '2012-10-17',
            },
            ManagedPolicyArns: [
              {
                'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              },
            ],
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'ssm:AddTagsToResource',
                        'ssm:RemoveTagsFromResource',
                        'ssm:GetParameters',
                      ],
                      Effect: 'Allow',
                      Resource: {
                        'Fn::Join': [
                          '',
                          [
                            'arn:',
                            {
                              Ref: 'AWS::Partition',
                            },
                            ':ssm:',
                            {
                              Ref: 'AWS::Region',
                            },
                            ':',
                            {
                              Ref: 'AWS::AccountId',
                            },
                            ':parameter/cdk/exports/Stack2/*',
                          ],
                        ],
                      },
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'Inline',
              },
            ],
          },
          Type: 'AWS::IAM::Role',
        },
        ExportsReader8B249524: {
          DeletionPolicy: 'Delete',
          Properties: {
            ReaderProps: {
              imports: {
                '/cdk/exports/MyResourceName': '{{resolve:ssm:/cdk/exports/MyResourceName}}',
              },
              region: {
                Ref: 'AWS::Region',
              },
              prefix: 'Stack2',
            },
            ServiceToken: {
              'Fn::GetAtt': [
                'CustomCrossRegionExportReaderCustomResourceProviderHandler46647B68',
                'Arn',
              ],
            },
          },
          Type: 'Custom::CrossRegionExportReader',
          UpdateReplacePolicy: 'Delete',
        },
        Nested1NestedStackNested1NestedStackResourceCD0AD36B: {
          DeletionPolicy: 'Delete',
          Properties: {
            TemplateURL: '<unresolved>',
          },
          Type: 'AWS::CloudFormation::Stack',
          UpdateReplacePolicy: 'Delete',
        },
      },
    });
  });
});
