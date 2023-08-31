import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda'
import { DynamoDB } from "aws-sdk"

const bankAccountDbd = process.env.BANK_ACCOUNT_DBD!
const ddbClient = new DynamoDB.DocumentClient()

interface BankAccount {
    id: string;
    countName: string;
    accountValue: number;
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>{

    const method =  event.httpMethod
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (method === 'GET') {

        try{
            const bankAccountId = event.pathParameters!.id!

            console.log(`GET /bankAccount/${bankAccountId}`)

            const bankAccount = await getBankAccountByCountName(bankAccountId)

            return {
                statusCode: 200,
                body: JSON.stringify(bankAccount)
            }
        } catch (error) {
            console.error((<Error>error).message)
            return {
                statusCode: 404,
                body: (<Error>error).message
            }
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

async function getBankAccountByCountName(countName: string): Promise<BankAccount> {
    const params = {
      TableName: bankAccountDbd,
      IndexName: 'CountNameIndex',
      KeyConditionExpression: 'countName = :countName',
      ExpressionAttributeValues: {
        ':countName': countName,
      },
      Limit: 1,
    };
  
    const data = await ddbClient.query(params).promise();
  
    if (data.Items && data.Items.length > 0) {
      return data.Items[0] as BankAccount;
    } else {
      throw new Error("BankAccount not found")
    }
  }