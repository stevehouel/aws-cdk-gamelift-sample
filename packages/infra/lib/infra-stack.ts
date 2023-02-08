import * as path from 'path';
import * as gamelift from '@aws-cdk/aws-gamelift-alpha';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ruleSet = new gamelift.MatchmakingRuleSet(this, 'QueuedMatchmakingConfiguration', {
      matchmakingRuleSetName: 'my-test-ruleset',
      content: gamelift.RuleSetContent.fromJsonFile(path.join(__dirname, 'my-ruleset/ruleset.json')),
    });

    const build = new gamelift.Build(this, 'Build', {
      content: gamelift.Content.fromAsset(path.join(__dirname, '../../game-server')),
      operatingSystem: gamelift.OperatingSystem.AMAZON_LINUX_2,
    });

    let serverProcess = [];
    for(var i = 1935; i < 2001; i++) {
      serverProcess.push({
        launchPath: '/local/game/TestApplicationServer',
        parameters: `port:${i} gameSessionLengthSeconds:20`,
        concurrentExecutions: 1,
      });
    }

    const fleet = new gamelift.BuildFleet(this, 'BuildFleet', {
      fleetName: 'test-fleet',
      content: build,
      ingressRules: [{
        source: gamelift.Peer.anyIpv4(),
        port: gamelift.Port.tcpRange(1935, 2000),
      }],
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.LARGE),
      runtimeConfiguration: {
        serverProcesses: serverProcess,
      },
    });

    //Adding new location
    fleet.addLocation('us-east-1');

    //Adding Live Alias to our fleet
    fleet.addAlias('Live');

    const queue = new gamelift.GameSessionQueue(this, 'MyGameSessionQueue', {
      gameSessionQueueName: 'test-gameSessionQueue',
      destinations: [fleet],
    });

    const matchmakingConfiguration = new gamelift.QueuedMatchmakingConfiguration(this, 'MyQueuedMatchmakingConfiguration', {
      matchmakingConfigurationName: 'test-config-name',
      gameSessionQueues: [queue],
      ruleSet: ruleSet
    });

    new cdk.CfnOutput(this, 'MatchmakingConfigurationArn', { value: matchmakingConfiguration.matchmakingConfigurationArn });
    new cdk.CfnOutput(this, 'MatchmakingConfigurationName', { value: matchmakingConfiguration.matchmakingConfigurationName });
  }
}
