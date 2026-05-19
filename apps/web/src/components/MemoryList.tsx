'use client';

import { Box, VStack, HStack, Text, Badge, Card, CardBody, IconButton, Tooltip } from '@chakra-ui/react';
import { Brain, Copy, Trash2, Tag } from 'lucide-react';

// Sample data - in production, this would fetch from ContextHub
const sampleMemories = [
  {
    id: '1',
    type: 'bugfix',
    content: 'Fixed race condition in user authentication by adding mutex lock around session creation',
    timestamp: Date.now() - 3600000,
    tags: ['auth', 'security', 'threading']
  },
  {
    id: '2',
    type: 'decision',
    content: 'Decided to use PostgreSQL for primary storage instead of SQLite due to concurrent access requirements',
    timestamp: Date.now() - 7200000,
    tags: ['database', 'architecture']
  },
  {
    id: '3',
    type: 'architecture',
    content: 'Implemented service layer pattern for API endpoints to separate business logic from controllers',
    timestamp: Date.now() - 86400000,
    tags: ['architecture', 'api']
  },
  {
    id: '4',
    type: 'manual',
    content: 'Remember to run migration script after deploying v2.3.0 to update user preferences schema',
    timestamp: Date.now() - 172800000,
    tags: ['deployment', 'reminder']
  },
];

const typeColors: Record<string, string> = {
  bugfix: 'red',
  decision: 'purple',
  architecture: 'blue',
  prompt: 'green',
  response: 'teal',
  summary: 'orange',
  manual: 'gray',
};

export default function MemoryList() {
  return (
    <VStack spacing={4} align="stretch">
      {sampleMemories.map((memory) => (
        <Card key={memory.id} bg="gray.700" variant="outline" size="sm">
          <CardBody>
            <HStack justify="space-between" mb={2}>
              <Badge colorScheme={typeColors[memory.type] || 'gray'}>
                {memory.type}
              </Badge>
              <HStack spacing={1}>
                <Tooltip label="Copy">
                  <IconButton
                    aria-label="Copy"
                    icon={<Copy size={14} />}
                    size="xs"
                    variant="ghost"
                  />
                </Tooltip>
                <Tooltip label="Delete">
                  <IconButton
                    aria-label="Delete"
                    icon={<Trash2 size={14} />}
                    size="xs"
                    variant="ghost"
                    color="red.400"
                  />
                </Tooltip>
              </HStack>
            </HStack>
            <Text mb={3}>{memory.content}</Text>
            <HStack spacing={2} flexWrap="wrap">
              <Tag size="sm" variant="subtle" colorScheme="gray">
                <HStack spacing={1}>
                  <Brain size={12} />
                  <Text fontSize="xs">
                    {new Date(memory.timestamp).toLocaleDateString()}
                  </Text>
                </HStack>
              </Tag>
              {memory.tags.map((tag) => (
                <Badge key={tag} size="sm" variant="outline" colorScheme="blue">
                  {tag}
                </Badge>
              ))}
            </HStack>
          </CardBody>
        </Card>
      ))}
    </VStack>
  );
}