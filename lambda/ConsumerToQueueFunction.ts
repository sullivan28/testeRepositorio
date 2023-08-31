import { DynamoDB } from "aws-sdk"
import { Context, SQSEvent } from 'aws-lambda'
import {v4 as uuid } from "uuid"

const ddbClient = new DynamoDB.DocumentClient()
const bankAccountDbd = process.env.BANK_ACCOUNT_DBD!

interface BankAccount {
    id: string;
    countName: string;
    accountValue: number;
}

export async function handler (event: SQSEvent, context: Context): Promise<void> {

    console.log(`Event: ${JSON.stringify(event)}`)

    const promises: Promise<void>[] = []

    event.Records.forEach((record) => {
        
        const body = JSON.parse(record.body!)
        
        const idTransaction = body.idTransaction as string
        const transactionType = body.transactionType as string
        const countName = body.countName as string
        const accountValue = body.value as number

        promises.push(executeAction(countName, idTransaction, transactionType, accountValue))
    })

    await Promise.all(promises)

    console.log("Success")
}

async function executeAction(countName: string, idTransaction: string , transactionType: string, accountValue: number): Promise<void> {
    try {

        const bankAccount = await getBankAccountByCountName(countName)

        if (bankAccount) {

            console.error("record found")
            console.log(`record found value: ${bankAccount.accountValue} - value update: ${accountValue}`)

            if (transactionType == 'credit') {
                bankAccount.accountValue += accountValue
                console.error("updated record")
            } else if (transactionType == 'debit') {
                bankAccount.accountValue -= accountValue
                console.error("updated record")
            }
            await updateBankAccount(bankAccount);
            console.log("Success updateBankAccount")

        } else {

            const bankAccount = populateBankAccount(countName, accountValue)
            await createBankAccount(bankAccount)
            console.log("Success createBankAccount")
        }

    } catch (error) {
        console.error((<Error>error).message)
    }
}

async function getBankAccountByCountName(countName: string): Promise<BankAccount | undefined> {
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
        return undefined;
    }
  }

async function updateBankAccount(bankAccount: BankAccount): Promise<BankAccount> {
    const data = await ddbClient.update({
        TableName: bankAccountDbd,
        Key: {
            id: bankAccount.id
        },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "set accountValue = :accountValue",
        ExpressionAttributeValues: {
            ":accountValue":bankAccount.accountValue,
        },
        ReturnValues: "UPDATED_NEW"
    }).promise()
    data.Attributes!.id = bankAccount.id
    return data.Attributes as BankAccount
}

function populateBankAccount(countName: string, accountValue: number): BankAccount {
    const bankAccount: BankAccount = {
        id: uuid(),
        countName: countName,
        accountValue: accountValue,
      };
    return bankAccount
}

async function createBankAccount(bankAccount: BankAccount): Promise<void> {
    await ddbClient.put({
        TableName: bankAccountDbd,
        Item: bankAccount
    }).promise()
} 

