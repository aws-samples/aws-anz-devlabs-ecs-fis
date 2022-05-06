#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcsFisStack } from '../lib/ecs-fis-stack';


const app = new cdk.App();

new EcsFisStack(app, 'EcsFisStack', {
  
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
  
});
