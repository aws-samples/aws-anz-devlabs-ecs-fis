# Chaos Enginnering experiments for applications running on Amazon ECS using AWS Fault Injection Simulator


This workshop provides an introduction to chaos engineering using Amazon Web Services (AWS) tooling, with a focus on AWS Fault Injection Simulator (FIS).

You will learn how to use FIS and other AWS tools to inject faults in your infrastructure to validate your system’s resilience as well as verifying your alarms, observability, and monitoring practices.

You will execute the following experiment scenarios against an application that is running on Amazon ECS and identify faults in the configuration. 
 - How to validate application resiliency if an ECS instance is interrupted?
 - How to test a failure of an ECS task?


## Environment Setup (This has to be performed by operator. This is a one time setup only)

1. Login to the Cloud9 instance that is already provisioned for you.   
2. Execute the following command. It will take approximately 5 mins to create all the required resources
    ```
    cd ~/environment/devlabs
    ./setup.sh
    ```
    The following resources will be created in your account:
    1. AWS VPC with 3 public subnets and 3 private subnets, spread across 3 Availability Zones.
    2. Amazon ECS Cluster with EC2 instance as launch type
    3. Task Definition for a sample application
    4. An ECS Service that has 1 replica of the task
       

## Cleanup (For subsequent re-runs, execute the below scripts to get the application to initial state)
1. Delete the experiment templates. Execute the command in the Cloud9 IDE
    ```
    for id in $(aws fis list-experiment-templates --query 'experimentTemplates[*].id' --output text) ; do aws fis delete-experiment-template --id $id ; done
    ```

2. Reset the ECS Instance and ECS Tasks
    ```
    aws ecs update-service --cluster ECS-FIS --service sample-app-service --desired-count 1
    aws autoscaling update-auto-scaling-group --auto-scaling-group-name ecs-fis-asg --min-size 1 --max-size 1
    aws ecs update-service --cluster ECS-FIS --service sample-app-service --desired-count 2
    ```

## Run the FIS experiments

<details>
<summary>Experiment 1: </summary>  

### Experiment 1: 

**What**: In this experiment, you will ensure that the containerized application running on Amazon ECS is designed in a fault tolerant way, so that even if an instance in the cluster fails, the application is still available.  


**How**: For injecting faults into the applications and AWS services, we will use the AWS Fault Injection Simulation (FIS) service. There are two steps in running AWS FIS experiments:  
a. **First step** is to create an experiment template, which instructs AWS FIS on what this experiment is about and against which resources the experiment will be run against.  
b. **Second step** is actual running of the experiment. 

#### Let us create an experiment template for the first experiment.

1. Navigate to AWS FIS console. You can also use this [direct link:](https://console.aws.amazon.com/fis/home?region=us-west-2#Home) 
2. Choose Experiment Templates on the left side.
![Create Experiment Template Home](/document/images/1-FIS-Create-Home.png "Create Experiment Template")

3. Click on 'Create Experiment Template'. This will open another page which helps in creating the FIS experiment template.
4. For Description enter "Testing if the application is still accessible if on the ECS Instance is down".
5. For Name enter "Test-ECS-Instance-Failure" 
6. For IAM Role, choose the IAM Role (from drodown) that was created as part of CloudFormation. The IAM Role name will be starting with 'EcsFisStack-fisrole....'
![Create Experiment Template Basic](/document/images/1-FIS-Create-Exp.png "Create Experiment Template First part")

7. Let us add actions. Actions define the kind of operation that FIS will execute. Click on 'Add Actions', in the Actions section. 
8. For Name enter "Stopping-ECS-Instance".
9. For Action Type, choose "aws:ec2:stop-instance" from the dropdown. 
10. For Target, choose "Instances-Target-1".
11. Click on Save at the top of Actions menu. 
![FIS Action](/document/images/1-FIS-Action.png "FIS Action")

12. Lets now define the targets against which the action will be executed. When you created an action, a default target named 'Instances-Target-1' was created in step 10. You should see that in the target section. Click on Edit. 
13. All the ECS instances that are created for this lab have a tag "DevLab:ANZ". For this experiment, we will target all the EC2 instances that have this tag set. In the target method, select 'Resource tags, filters and parameters'.
14. Click Add New tag. 
15. For Key, provide 'DevLab'. For Value, enter 'ANZ'.
16. Let us target only the running instances. Click on 'Add New Filter'. Enter 'State.Name' for Attribute Path and 'running' for value.
17. In the Selection Mode dropdown, choose Count and give the value for 'Number of resources' as 1.
18. Leave all othere fields as it is. Click on Save. 
![FIS Target](/document/images/1-FIS-Target.png "FIS Target")

19. Click on 'Create Experiment Template' at the end of the page. It will ask for an additional confirmation in the popup. Enter create and confirm.

#### Its time now to run the experiment and validate the experiemnt scenario. 

1. Click on Actions and click on Start.
2. In the next page, click on Start Experiment. 
3. In the popup, enter 'start' and confirm.
![FIS Start](/document/images/1-FIS-ExpTemplate-Start.png "FIS Start")


#### Lets access the application:

1. Get the application URL from the following command
    ```
    appURL=`aws cloudformation describe-stacks --region us-west-2 --stack-name=EcsFisStack --query "Stacks[0].Outputs[?OutputKey=='FisEcsUrl'].OutputValue[]" --output text` 
    ```
2. Hit the URL either in the browser or even from Cloud9 command line
    ```
    curl $appURL
    ```
3. What do you observe? Why is application returning '503 Service Temporarily Unavailable' response? 

#### Lets Observe whats happening:

1. The ECS Service is configured to run 2 instances of the same task. However, the ECS Cluster has only 1 EC2 instance attached to it. As per the FIS experiment, the only EC2 instance was terminated and hence the ECS tasks had no compute to run on.  
2. The Auto Scaling Group for EC2 instance will eventually bring up a new instance, which gets attached to ECS cluster and the pending tasks gets deployed. Eventually the application becomes available. However, there will be a delay during the time where the ASG will bring up a new instance and task gets deployed.  
3. As a best practice to ensure high availability of the applications, we should not only look at running multiple instances of ECS tasks, we should also ensure that the underlying EC2 instance is also configured to be highly available.  

### Lets fix the problem:

1. Navigate to Auto Scaling Groups in the EC2 console. Or use this [direct link](https://us-west-2.console.aws.amazon.com/ec2autoscaling/home?region=us-west-2#/details)
2. Choose the only ASG. Observe that the minimum, maximum and desired capacity is set as 1. 
3. Click on Edit and increase the desired capacity,  minimum capacity and maximum capacity to 2. Click on Update. This will bring up additional EC2 instance, which will be attached to the ECS cluster. 
![ASG](/document/images/1-FIS-ASG.png "ASG Update")

4. Navigate to [EC2 instances tab](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances) and observe the new instance being created automatically. 

### Validate again

1. Navigate to [FIS console](https://us-west-2.console.aws.amazon.com/fis/home?region=us-west-2#ExperimentTemplates) and click on the experiment ID for the 'Test-ECS-Instance-Failure' experiment.
2. Choose Actions and Start the experiment. Confirm in the popup menu as earlier. 
3. Hit the URL again, either in the browser or even from Cloud9 command line
    ```
    curl $appURL
    ```
4. Notice that the even when one of the instance is terminated, the application is still accessbile. This is due to HA configuration of the ECS task as well as the EC2 instance. 

</details>


<details>
<summary>Experiment 2: </summary>  


### Experiment 2: 

**What**: In this experiment, you will test if the ECS application is highly available. Even if one of the ECS task fails, the application would be running at a lower capacity for a short duration and this should not affect the entire application. ECS Service will bring up additional tasks to ensure that the desired number of tasks are running. 


**How**: For injecting faults into the applications and AWS services, we will use the AWS Fault Injection Simulation (FIS) service. There are two steps in running AWS FIS experiments:  
a. **First step** is to create an experiment template, which instructs AWS FIS on what this experiment is about and against which resources the experiment will be run against.  
b. **Second step** is actual running of the experiment. 

#### Let us create an experiment template for the second experiment.

1. Navigate to AWS FIS console. You can also use this [direct link:](https://console.aws.amazon.com/fis/home?region=us-west-2#Home) 
2. Choose Experiment Templates on the left side.
![Create Experiment Template Home](/document/images/1-FIS-Create-Home.png "Create Experiment Template")

3. Click on 'Create Experiment Template'. This will open another page which helps in creating the FIS experiment template.
4. For Description enter "Testing if the application is accessible even if one of the task fails".
5. For Name enter "Test-ECS-Task-Failure" 
6. For IAM Role, choose the IAM Role (from drodown) that was created as part of CloudFormation. The IAM Role name will be starting with 'EcsFisStack-fisrole....'
![Create Experiment Template Basic](/document/images/2-FIS-Create-Exp.png "Create Experiment Template First part")

7. Let us add actions. Actions define the kind of operation that FIS will execute. Click on 'Add Actions', in the Actions section. 
8. For Name enter "Interrupting-ECS-Task".
9. For Action Type, choose "aws:ecs:stop-task" from the dropdown. 
10. For Target, choose "Tasks-Target-1".
11. Click on Save at the top of Actions menu. 
![FIS Action](/document/images/2-FIS-Action.png "FIS Action")

12. Lets now define the targets against which the action will be executed. When you created an action, a default target named 'Tasks-Target-1' was created in step 10. You should see that in the target section. Click on Edit. 
13. In the previous experiment, we observed how to randomly choose the resources based on tags. In this experiment, we will choose the option to select the task directly. For the Target method, choose 'Resource IDs'.
14. Select one task from the dropdown for 'Resource IDs' and click on Save. 
![FIS Target](/document/images/2-FIS-Target.png "FIS Target")
15. Click on 'Create Experiment Template' at the end of the page. It will ask for an additional confirmation in the popup. Enter create and confirm.

#### Its time now to run the experiment and validate the experiemnt scenario. 

1. Click on Actions and click on Start.
2. In the next page, click on Start Experiment. 
3. In the popup, enter 'start' and confirm.
![FIS Start](/document/images/2-FIS-ExpTemplate-Start.png "FIS Start")


#### Lets access the application:

1. Get the application URL from the following command
    ```
    appURL=`aws cloudformation describe-stacks --region us-west-2 --stack-name=EcsFisStack --query "Stacks[0].Outputs[?OutputKey=='FisEcsUrl'].OutputValue[]" --output text` 
    ```
2. Hit the URL either in the browser or even from Cloud9 command line
    ```
    curl $appURL
    ```
3. What do you observe? The application is still accessible. 

#### Lets observe whats happening within ECS
1. Navigate to ECS Cluster home page. Use this [direct link](https://us-west-2.console.aws.amazon.com/ecs/home?region=us-west-2#/clusters)
2. Select the ECS Cluster thas is created with the name 'ECS-FIS'.
![ECS Cluster](/document/images/2-ECS-Cluster.png "ECS Cluster")
3. Choose the Services tab and click on the service name 'sample-app-service'. 
![ECS Service](/document/images/2-ECS-Service.png "ECS Service")
4. Click on the Events tab. This will list all the events that happened within the services. Observe the latest five events.    
    a. The fifth event says that the ECS task is getting de-registered. This is due to the FIS experiment that we executed.   
    b. The third event says that a new ECS task is being provisioned. This is because, ECS service has been configured to run two tasks at any given point in time. Since one task was terminated by the experiment, ECS Service identified that the desired tasks is not matching the actual tasks. Hence it will balance this by bringing up a new task. 
![ECS Events](/document/images/2-ECS-Events.png "ECS Events")

</details>