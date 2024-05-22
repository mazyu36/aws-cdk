import { IFunction } from '../../aws-lambda';
import { CfnResolver } from './appsync.generated';

/**
 * Specifies which Conflict Detection strategy and Resolution strategy
 * to use when the resolver is invoked.
 */
export interface SyncConfigProps {
  /**
   * The Conflict Detection strategy to use.
   */
  readonly conflictDetection: ConflictDetection;

  /**
   * The Conflict Resolution strategy to perform in the event of a conflict.
   * @default - No conflict handler
   */
  readonly conflictHandler?: ConflictHandler;

  /**
   * The Lambda function as the Conflict Handler.
   * It must be set when use ConflictHandler.LAMBDA.
   *
   * @default - No function
   */
  readonly lambdaConflictHandler: IFunction;
}

/**
 * The Conflict Detection strategy to use.
 */
export enum ConflictDetection {
  /**
   * Detect conflicts based on object versions for this resolver.
   */
  VERSION = 'VERSION',
  /**
   * Do not detect conflicts when invoking this resolver.
   */
  NONE = 'NONE',
}

/**
 * The Conflict Resolution strategy to perform in the event of a conflict.
 */
export enum ConflictHandler {
  /**
   * Resolve conflicts by rejecting mutations when versions don't match
   * the latest version at the server.
   */
  OPTIMISTIC_CONCURRENCY = 'OPTIMISTIC_CONCURRENCY',
  /**
   * Resolve conflicts with the Automerge conflict resolution strategy.
   */
  AUTOMERGE = 'AUTOMERGE',
  /**
   * Resolve conflicts with an AWS Lambda function supplied in the LambdaConflictHandlerConfig.
   */
  LAMBDA = 'LAMBDA',
}

export class SyncConfig {
  constructor(private readonly props: SyncConfigProps) {
    if (props.conflictHandler === ConflictHandler.LAMBDA && !props.lambdaConflictHandler) {
      throw new Error('You must specify `lambdaConflictHandler` when use `ConflictHandler.LAMBDA`');
    }
  }

  /**
   * Called when the SyncConfig is configured on a resolver
   */
  public bind(): CfnResolver.SyncConfigProperty {

    let lambdaConflictHandlerConfig;
    if (this.props.lambdaConflictHandler) {
      lambdaConflictHandlerConfig = {
        lambdaConflictHandlerArn: this.props.lambdaConflictHandler!.functionArn,
      };
    }

    return {
      conflictDetection: this.props.conflictDetection,
      conflictHandler: this.props.conflictHandler,
      lambdaConflictHandlerConfig: lambdaConflictHandlerConfig,
    };
  }
}
