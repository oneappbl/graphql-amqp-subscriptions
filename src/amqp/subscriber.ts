import amqp from 'amqplib';
import Debug from 'debug';

import { Logger } from './common';
import { PubSubAMQPConfig, Exchange, Queue } from './interfaces';

export class AMQPSubscriber {
  private connection: amqp.Connection;
  private exchange: Exchange;
  private queue: Queue;
  private channel: amqp.Channel | null = null;
  private creatingChannel: boolean = false;

  constructor(
    private config: PubSubAMQPConfig,
    private logger: Debug.IDebugger
  ) {
    this.connection = config.connection;
    this.exchange = config.exchange;
    this.queue = config.queue;
  }

  public async subscribe(
    routingKey: string,
    action: (routingKey: string, message: any) => void
  ): Promise<() => Promise<void>> {
    // Create and bind queue
    const channel = await this.getOrCreateChannel();
    await channel.assertExchange(this.exchange.name, this.exchange.type, { ...this.exchange.options });
    const queue = await channel.assertQueue(this.queue.name || '', { ...this.queue.options });
    await channel.bindQueue(queue.queue, this.exchange.name, routingKey);

    // Listen for messages
    const opts = await channel.consume(queue.queue, (msg) => {
      let parsedMessage = Logger.convertMessage(msg);
      this.logger('Message arrived from Queue "%s" (%j)', queue.queue, parsedMessage);
      action(routingKey, parsedMessage);
    }, {noAck: true});
    this.logger('Subscribed to Queue "%s" (%s)', queue.queue, opts.consumerTag);

    // Dispose callback
    return async (): Promise<void> => {
      this.logger('Disposing Subscriber to Queue "%s" (%s)', queue.queue, opts.consumerTag);
      const ch = await this.getOrCreateChannel();
      await ch.cancel(opts.consumerTag);
      await ch.unbindQueue(queue.queue, this.exchange.name, routingKey);
      await ch.deleteQueue(queue.queue);
    };
  }

  public async close(): Promise<void> {
    if (this.channel) {
      const ch = this.channel;
      this.channel = null;
      await ch.close();
      this.logger('sub channel closed');
    }
  }

  private async sleep(i: number): Promise<void> {
    return new Promise(resolve =>
      global.setTimeout(resolve, i)
    );
  }

  private async getOrCreateChannel(): Promise<amqp.Channel> {
    if (!this.creatingChannel && !this.channel) {
      this.creatingChannel = true;
      this.channel = await this.connection.createChannel();
      this.creatingChannel = false;
      this.logger('sub channel created');
      this.channel.on('error', (err) => { this.logger('Subscriber channel error: "%j"', err); });
    }
    while (!this.channel) {
      this.logger('still no sub channel');
      await this.sleep(200);
    }
    return this.channel;
  }
}
