import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import { DynamoDB } from "aws-sdk"
import {v4 as uuid } from "uuid"

const transactionDbd = process.env.TRANSACTION_DBD!
const ddbClient = new DynamoDB.DocumentClient()

interface Transaction {
    id: string;
    countName: string;
    transactionType: string;
    value: number;
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>{

    const method =  event.httpMethod
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (method === 'POST') {
        
        console.log("POST /transaction")

        const transaction = JSON.parse(event.body!) as Transaction
        const transactionCreated = await create(transaction)
        return {
            statusCode: 201,
            body: JSON.stringify(transactionCreated)
        }
    }

    return {
        statusCode: 400,
        headers: {},
        body:JSON.stringify({
            message: "Bad request"
        })
    }
}

async function create(transaction: Transaction): Promise<Transaction> {
    transaction.id = uuid()
    await ddbClient.put({
        TableName: transactionDbd,
        Item: transaction
    }).promise()
    return transaction
} 