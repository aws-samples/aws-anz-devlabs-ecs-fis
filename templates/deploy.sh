#!/bin/bash

set -e
set -u
set -o pipefail

#
# This is a hack for development and assembly. Eventually there should be a single template 
# to deploy

MODE=${1:-"create"}
case $MODE in
    create|update)
        echo "Deploy mode: $MODE"
        ;;
    delete)
        echo "Deleting all stacks not curently implemented"
        exit 1
        ;;
    *)
        echo "Please select one of create / update"
        exit 1
        ;;
esac

REGION=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].[RegionName]')
ACCOUNT_ID=$(aws sts get-caller-identity --output text --query 'Account')

echo "Deploying to AWS Account: ${ACCOUNT_ID}"
echo "Deploying to Region: ${REGION}"

echo "Boostrapping account with CDK"
cdk bootstrap aws://${ACCOUNT_ID}/${REGION}

# VPC stack uses CDK
(
    echo "Provisioning All..."
    cd ecs-fis
    npm install
    npx cdk deploy EcsFisStack --require-approval never --outputs-file outputs.json
)






echo Done.
