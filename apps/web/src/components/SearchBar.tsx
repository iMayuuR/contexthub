'use client';

import { useState } from 'react';
import { Input, InputGroup, InputLeftElement, Box, Text, VStack, Card, CardBody, Heading } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { contexthubClient } from '@/lib/contexthub-client';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      setLoading(true);
      try {
        const data = await contexthubClient.query(query);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Box>
      <InputGroup size="lg">
        <InputLeftElement pointerEvents="none">
          <Search color="gray" size={20} />
        </InputLeftElement>
        <Input
          placeholder="Search memories... (e.g., 'authentication bug', 'api design')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
          bg="gray.800"
          border="1px"
          borderColor="gray.600"
          _placeholder={{ color: 'gray.400' }}
          _hover={{ borderColor: 'gray.500' }}
          _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
        />
      </InputGroup>
      {loading && <Text mt={2} color="gray.400">Stitching context...</Text>}
      {results && (
        <VStack mt={4} spacing={4} align="stretch">
          {results.exactMatch && (
            <Card bg="gray.800" border="1px" borderColor="blue.500">
              <CardBody>
                <Heading size="xs" color="blue.400" mb={2}>EXACT MEMORY MATCH</Heading>
                <Text fontSize="sm">{results.exactMatch.content}</Text>
              </CardBody>
            </Card>
          )}
          {results.contextChunks && results.contextChunks.length > 0 && (
            <Card bg="gray.800" border="1px" borderColor="gray.600">
              <CardBody>
                <Heading size="xs" color="gray.300" mb={2}>SEMANTIC CONTEXT</Heading>
                <VStack align="stretch" spacing={2}>
                  {results.contextChunks.map((chunk: string, i: number) => (
                    <Text key={i} fontSize="sm">- {chunk}</Text>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      )}
      {!results && !loading && query && (
        <Text mt={2} color="gray.400" fontSize="sm">
          Press Enter to search...
        </Text>
      )}
    </Box>
  );
}