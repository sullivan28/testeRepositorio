#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
import { BankAccountServiceStack } from '../lib/bank-account-service-stack';

const app = new cdk.App();

new BankAccountServiceStack(app, 'BankAccountServiceStack-${process.env.NAMESPACE}', { 
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});