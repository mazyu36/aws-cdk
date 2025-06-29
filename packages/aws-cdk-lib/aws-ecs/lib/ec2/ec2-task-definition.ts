import { Construct } from 'constructs';
import { Stack, ValidationError } from '../../../core';
import { addConstructMetadata } from '../../../core/lib/metadata-resource';
import { propertyInjectable } from '../../../core/lib/prop-injectable';
import { ImportedTaskDefinition } from '../base/_imported-task-definition';
import {
  CommonTaskDefinitionAttributes,
  CommonTaskDefinitionProps,
  Compatibility,
  InferenceAccelerator,
  IpcMode,
  ITaskDefinition,
  NetworkMode,
  PidMode,
  TaskDefinition,
} from '../base/task-definition';
import { ContainerDefinition, ContainerDefinitionOptions } from '../container-definition';
import { PlacementConstraint } from '../placement';

/**
 * The properties for a task definition run on an EC2 cluster.
 */
export interface Ec2TaskDefinitionProps extends CommonTaskDefinitionProps {
  /**
   * The Docker networking mode to use for the containers in the task.
   *
   * The valid values are NONE, BRIDGE, AWS_VPC, and HOST.
   *
   * @default - NetworkMode.BRIDGE for EC2 tasks, AWS_VPC for Fargate tasks.
   */
  readonly networkMode?: NetworkMode;

  /**
   * An array of placement constraint objects to use for the task. You can
   * specify a maximum of 10 constraints per task (this limit includes
   * constraints in the task definition and those specified at run time).
   *
   * @default - No placement constraints.
   */
  readonly placementConstraints?: PlacementConstraint[];

  /**
   * The IPC resource namespace to use for the containers in the task.
   *
   * Not supported in Fargate and Windows containers.
   *
   * @default - IpcMode used by the task is not specified
   */
  readonly ipcMode?: IpcMode;

  /**
   * The process namespace to use for the containers in the task.
   *
   * Not supported in Windows containers.
   *
   * @default - PidMode used by the task is not specified
   */
  readonly pidMode?: PidMode;

  /**
   * The inference accelerators to use for the containers in the task.
   *
   * Not supported in Fargate.
   *
   * @default - No inference accelerators.
   */
  readonly inferenceAccelerators?: InferenceAccelerator[];
}

/**
 * The interface of a task definition run on an EC2 cluster.
 */
export interface IEc2TaskDefinition extends ITaskDefinition {

}

/**
 * Attributes used to import an existing EC2 task definition
 */
export interface Ec2TaskDefinitionAttributes extends CommonTaskDefinitionAttributes {

}

/**
 * The details of a task definition run on an EC2 cluster.
 *
 * @resource AWS::ECS::TaskDefinition
 */
@propertyInjectable
export class Ec2TaskDefinition extends TaskDefinition implements IEc2TaskDefinition {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-ecs.Ec2TaskDefinition';

  /**
   * Imports a task definition from the specified task definition ARN.
   */
  public static fromEc2TaskDefinitionArn(scope: Construct, id: string, ec2TaskDefinitionArn: string): IEc2TaskDefinition {
    return new ImportedTaskDefinition(scope, id, {
      taskDefinitionArn: ec2TaskDefinitionArn,
    });
  }

  /**
   * Imports an existing Ec2 task definition from its attributes
   */
  public static fromEc2TaskDefinitionAttributes(
    scope: Construct,
    id: string,
    attrs: Ec2TaskDefinitionAttributes,
  ): IEc2TaskDefinition {
    return new ImportedTaskDefinition(scope, id, {
      taskDefinitionArn: attrs.taskDefinitionArn,
      compatibility: Compatibility.EC2,
      networkMode: attrs.networkMode,
      taskRole: attrs.taskRole,
      executionRole: attrs.executionRole,
    });
  }

  /**
   * Validates the placement constraints to make sure they are supported.
   * Currently, only 'memberOf' is a valid constraint for an Ec2TaskDefinition.
   */
  private static validatePlacementConstraints(scope: Construct, constraints?: PlacementConstraint[]) {
    // List of valid constraints https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-taskdefinition-taskdefinitionplacementconstraint.html#cfn-ecs-taskdefinition-taskdefinitionplacementconstraint-type
    const validConstraints = new Set(['memberOf']);

    // Check if any of the placement constraints are not valid
    const invalidConstraints = constraints?.filter(constraint => {
      return constraint.toJson().some(constraintProperty => !validConstraints.has(constraintProperty.type));
    }) ?? [];

    if (invalidConstraints.length > 0) {
      const invalidConstraintTypes = invalidConstraints.map(
        constraint => constraint.toJson().map(constraintProperty => constraintProperty.type)).flat();
      throw new ValidationError(`Invalid placement constraint(s): ${invalidConstraintTypes.join(', ')}. Only 'memberOf' is currently supported in the Ec2TaskDefinition class.`, scope);
    }
  }

  /**
   * Constructs a new instance of the Ec2TaskDefinition class.
   */
  constructor(scope: Construct, id: string, props: Ec2TaskDefinitionProps = {}) {
    // don't pass @deprecated inferenceAccelerators if not needed as this renders console warnings
    if (props.inferenceAccelerators) {
      super(scope, id, {
        ...props,
        compatibility: Compatibility.EC2,
        placementConstraints: props.placementConstraints,
        ipcMode: props.ipcMode,
        pidMode: props.pidMode,
        inferenceAccelerators: props.inferenceAccelerators,
      });
    } else {
      super(scope, id, {
        ...props,
        compatibility: Compatibility.EC2,
        placementConstraints: props.placementConstraints,
        ipcMode: props.ipcMode,
        pidMode: props.pidMode,
      });
    }

    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    // Validate the placement constraints
    Ec2TaskDefinition.validatePlacementConstraints(scope, props.placementConstraints ?? []);
  }

  /**
   * Tasks running in AWSVPC networking mode requires an additional environment variable for the region to be sourced.
   * This override adds in the additional environment variable as required
   */
  override addContainer(id: string, props: ContainerDefinitionOptions): ContainerDefinition {
    if (this.networkMode === NetworkMode.AWS_VPC) {
      return super.addContainer(id, {
        ...props,
        environment: {
          ...props.environment,
          AWS_REGION: Stack.of(this).region,
        },
      });
    }
    // If network mode is not AWSVPC, then just add the container as normal
    return super.addContainer(id, props);
  }
}
