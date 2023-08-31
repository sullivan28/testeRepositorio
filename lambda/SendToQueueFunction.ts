import { Context, DynamoDBStreamEvent } from 'aws-lambda'
import { SQS } from "aws-sdk"

const sqsClient = new SQS()
const queueUrl = process.env.QUEUE_URL!

export async function handler (event: DynamoDBStreamEvent, context: Context) {

    try{

        for (const record of event.Records) {

            const data = record.dynamodb?.NewImage;

            const messageBody = {
                idTransaction: data?.idTransaction?.S,
                transactionType: data?.transactionType?.S,
                countName: data?.countName?.S,
                value: Number(data?.value?.N),
              };

            await sqsClient.sendMessage({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(messageBody)
            }).promise()
            return {
                statusCode: 200,
                body: JSON.stringify("Success")
            }

        }

    } catch (error) {
        console.error((<Error>error).message)
        return {
            statusCode: 500,
            body: (<Error>error).message
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