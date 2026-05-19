'use client';

import { Box, VStack, HStack, Text, Badge, Card, CardBody, Avatar, Wrap, WrapItem } from '@chakra-ui/react';
import { Clock, Bot, User } from 'lucide-react';

interface Session {
  id: string;
  agent: string;
  startTime: number;
  endTime?: number;
  memoryCount: number;
}

const sampleSessions: Session[] = [
  {
    id: '1',
    agent: 'claude-code',
    startTime: Date.now() - 3600000,
    endTime: Date.now() - 1800000,
    memoryCount: 12,
  },
  {
    id: '2',
    agent: 'cursor',
    startTime: Date.now() - 7200000,
    endTime: Date.now() - 5400000,
    memoryCount: 8,
  },
  {
    id: '3',
    agent: 'claude-code',
    startTime: Date.now() - 86400000,
    endTime: Date.now() - 82800000,
    memoryCount: 25,
  },
];

const agentColors: Record<string, string> = {
  'claude-code': 'blue',
  'cursor': 'green',
  'cli': 'purple',
};

export default function TimelineView() {
  return (
    <VStack spacing={4} align="stretch">
      {sampleSessions.map((session) => (
        <Card key={session.id} bg="gray.800" border="1px" borderColor="gray.700">
          <CardBody>
            <HStack spacing={4}>
              <Avatar
                size="md"
                icon={session.agent === 'cli' ? <Clock size={20} /> : <Bot size={20} />}
                bg={`${agentColors[session.agent] || 'gray'}.500`}
              />
              <Box flex={1}>
                <HStack justify="space-between" mb={1}>
                  <HStack>
                    <Text fontWeight="bold" textTransform="capitalize">
                      {session.agent.replace('-', ' ')}
                    </Text>
                    <Badge variant="outline" colorScheme={agentColors[session.agent] || 'gray'}>
                      {session.memoryCount} memories
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="gray.400">
                    {new Date(session.startTime).toLocaleString()}
                  </Text>
                </HStack>
                <Text fontSize="sm" color="gray.400">
                  Duration: {Math.round((session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime) / 60000)} minutes
                </Text>
              </Box>
            </HStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
}