import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as autoscaling from "aws-cdk-lib/aws-autoscaling";
import * as iam from "aws-cdk-lib/aws-iam";
import * as fis from "aws-cdk-lib/aws-fis";



export class EcsFisStack extends Stack {

  public vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    //*** Begin VPC Block ***/ 
    this.vpc = new ec2.Vpc(this, 'FisVpc', {
      cidr: "10.0.0.0/16",
      maxAzs: 3
    });
    //*** End VPC Block ***/ 

    //*** Begin ECS Block ***/ 
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: this.vpc,
      clusterName: 'ECS-FIS'
    });

    // cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
    //   instanceType: new ec2.InstanceType("t3.medium"),
    //   desiredCapacity: 1,
    //   autoScalingGroupName: 'ecs-fis-asg'
    // });

    const asg = new autoscaling.AutoScalingGroup(this, "EcsAsgProvider", {
      vpc: this.vpc,
      instanceType: new ec2.InstanceType("t3.medium"),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      desiredCapacity: 1
    });

    Tags.of(asg).add("DevLab","ANZ");

    cluster.addAsgCapacityProvider(
      new ecs.AsgCapacityProvider(this, "CapacityProvider", {
        autoScalingGroup: asg,
        capacityProviderName: "fisWorkshopCapacityProvider",
        enableManagedTerminationProtection: false
      })
    );

    // Add SSM access policy to nodegroup
    asg.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

    const taskDefinition = new ecs.Ec2TaskDefinition(this, "SampleAppTaskDefinition", {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    taskDefinition.addContainer("SampleAppContainer", {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 256,
      portMappings: [
        {
          containerPort: 80,
          hostPort: 80
        }
      ]
    });

    const sampleAppService = new ecs_patterns.ApplicationLoadBalancedEc2Service(this, "SampleAppService", {
      cluster: cluster,
      serviceName: 'sample-app-service',
      cpu: 256,
      desiredCount: 2,
      memoryLimitMiB: 512,
      taskDefinition: taskDefinition
    });

    //asg.attachToApplicationTargetGroup(sampleAppService.targetGroup);
    //*** End ECS Block ***/ 

    //*** Begin FIS IAM Block ***/ 
    
    const fisrole = new iam.Role(this, "fis-role", {
      assumedBy: new iam.ServicePrincipal("fis.amazonaws.com", {
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
          ArnLike: {
            "aws:SourceArn": `arn:aws:fis:${this.region}:${this.account}:experiment/*`,
          },
        },
      }),
    });

    // AllowFISExperimentRoleECSReadOnly
    fisrole.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["ecs:ListContainerInstances", "ecs:DescribeClusters", "ecs:StopTask"],
      })
    );

    // AllowFISExperimentRoleECSUpdateState
    fisrole.addToPolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:ecs:*:*:container-instance/*`],
        actions: ["ecs:UpdateContainerInstancesState"],
      })
    );

    // AllowFISExperimentRoleEC2Actions
    fisrole.addToPolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:ec2:*:*:instance/*`],
        actions: [
          "ec2:RebootInstances",
          "ec2:StopInstances",
          "ec2:StartInstances",
          "ec2:TerminateInstances"
        ]
      })
    );

    //AllowFISExperimentRoleSSMReadOnly
    fisrole.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "ec2:DescribeInstances",
          "ssm:ListCommands",
          "ssm:CancelCommand",
          "ssm:PutParameter",
          "ssm:SendCommand"
        ],
      })
    );

   


    //*** End FIS IAM Block ***/ 

    const ecsUrl = new cdk.CfnOutput(this, 'FisEcsUrl', { value: 'http://' + sampleAppService.loadBalancer.loadBalancerDnsName });

    // Outputs
    new cdk.CfnOutput(this, "FISIamRoleArn", {
      value: fisrole.roleArn,
      description: "The Arn of the IAM role",
      exportName: "FISIamRoleArn",
    });


  }
}
