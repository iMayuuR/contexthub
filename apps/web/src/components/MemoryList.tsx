'use client';

import { Box, VStack, HStack, Text, Badge, Card, CardBody, IconButton, Tooltip } from '@chakra-ui/react';
import { Brain, Copy, Trash2, Tag } from 'lucide-react';

import { useState, useEffect } from 'react';
import { contexthubClient } from '@/lib/contexthub-client';

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
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contexthubClient.getMemories()
      .then(data => {
        setMemories(data.memories || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load memories:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <Text>Loading memories...</Text>;

  return (
    <VStack spacing={4} align="stretch">
      {memories.map((memory) => (
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
              {memory.tags?.map((tag: string) => (
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