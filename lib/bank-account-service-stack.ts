import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { DynamoEventSource, SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';


export class BankAccountServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const transactionDbd = new dynamodb.Table(this, "TransactionDbd", {
      tableName: "transaction",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
          name: "id",
          type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      readCapacity: 1,
      writeCapacity: 1
    })

    const transactionHandler = new lambdaNodeJS.NodejsFunction(this, "TransactionFunction", {
      functionName: "TransactionFunction",
      entry: "lambda/TransactionFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(3),
      bundling: {
          minify: true,
          sourceMap: false
      },
      environment: {
          TRANSACTION_DBD: transactionDbd.tableName
      }
    })

    transactionDbd.grantReadWriteData(transactionHandler)

    const queueTransactionDlq = new sqs.Queue(this, "QueueTransactionDlq", {
      queueName: "queueTransactionDlq"
    })
    const queueTransaction = new sqs.Queue(this, "QueueTransaction", {
      queueName: "queueTransaction",
      deadLetterQueue: {
        queue: queueTransactionDlq,
        maxReceiveCount: 2
      }
    })

    const sendToQueue = new lambdaNodeJS.NodejsFunction(this, "SendToQueueFunction", {
      functionName: "SendToQueueFunction",
      entry: "lambda/SendToQueueFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(3),
      bundling: {
          minify: true,
          sourceMap: false
      },
      environment: {
        QUEUE_URL: queueTransaction.queueUrl
      }
    })

    sendToQueue.addEventSource(new DynamoEventSource(transactionDbd, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 1,
    }));

    queueTransaction.grantSendMessages(sendToQueue);

    const bankAccountDbd = new dynamodb.Table(this, "BankAccountDbd", {
      tableName: "bankAccount",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
          name: "id",
          type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1
    })

    bankAccountDbd.addGlobalSecondaryIndex({
      indexName: "CountNameIndex",
      partitionKey: {
        name: "countName",
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const consumerToQueue = new lambdaNodeJS.NodejsFunction(this, "ConsumerToQueueFunction", {
      functionName: "ConsumerToQueueFunction",
      entry: "lambda/ConsumerToQueueFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(3),
      bundling: {
          minify: true,
          sourceMap: false
      },
      environment: {
        BANK_ACCOUNT_DBD: bankAccountDbd.tableName
      }
    })

    consumerToQueue.addEventSource(new SqsEventSource(queueTransaction, {
      batchSize: 1,
    }))

    queueTransaction.grantConsumeMessages(consumerToQueue);
    bankAccountDbd.grantReadWriteData(consumerToQueue)

    const bankAccountHandler = new lambdaNodeJS.NodejsFunction(this, "BankAccountFunction", {
      functionName: "BankAccountFunction",
      entry: "lambda/BankAccountFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(3),
      bundling: {
          minify: true,
          sourceMap: false
      },
      environment: {
          BANK_ACCOUNT_DBD: bankAccountDbd.tableName
      }
    })

    bankAccountDbd.grantReadWriteData(bankAccountHandler)

    const  api = new apigateway.RestApi(this, "BankAccountServiceAPI", {
      restApiName: "Bank Account Service API"
    })

    const transactionIntegration = new apigateway.LambdaIntegration(transactionHandler)
    const transactionResource = api.root.addResource("transaction")
    transactionResource.addMethod("POST", transactionIntegration)

    const bankAccountIntegration = new apigateway.LambdaIntegration(bankAccountHandler)
    const bankAccountResource = api.root.addResource("bankAccount")
    const bankAccountIdResource = bankAccountResource.addResource("{id}")
    bankAccountIdResource.addMethod("GET", bankAccountIntegration)
  }
}
