import amqp from 'amqplib';
import { PubSubEngine } from 'graphql-subscriptions';

export interface Exchange {
  name: string;
  type: string;
  options?: {
    durable?: boolean;
    autoDelete?: boolean;
  };
}

export interface Queue {
  name?: string;
  options?: {
    exclusive?: boolean;
    durable?: boolean;
    autoDelete?: boolean;
  };
}

export interface PubSubAMQPConfig {
  connection: amqp.Connection;
  exchange: Exchange;
  queue: Queue;
}

export interface AsyncIteratorWithSubscribeAll<T> extends AsyncIterator<T> {
  didAllSubscribe: () => Promise<number[]>;
}

export interface PubSubEngineWithCleanup extends PubSubEngine {
  cleanupConnections: () => void;
}
