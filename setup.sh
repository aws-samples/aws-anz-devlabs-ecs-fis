#!/bin/bash

set -e
set -u
set -o pipefail

REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --output text --query 'Account')

echo "Deploying to AWS Account: ${ACCOUNT_ID}"
echo "Deploying to Region: ${REGION}"

echo "Boostrapping account with CDK"
cdk bootstrap aws://${ACCOUNT_ID}/${REGION}

# Provisioning required resources
(
    echo "Provisioning All"
    cd templates/ecs-fis
    npm install
    npx cdk deploy EcsFisStack --require-approval never --outputs-file outputs.json
)

echo Done.
