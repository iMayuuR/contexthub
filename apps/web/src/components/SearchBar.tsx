'use client';

import { useState } from 'react';
import { Input, InputGroup, InputLeftElement, Box, Text } from '@chakra-ui/react';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const [query, setQuery] = useState('');

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
          bg="gray.800"
          border="1px"
          borderColor="gray.600"
          _placeholder={{ color: 'gray.400' }}
          _hover={{ borderColor: 'gray.500' }}
          _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
        />
      </InputGroup>
      {query && (
        <Text mt={2} color="gray.400" fontSize="sm">
          Press Enter or wait for results...
        </Text>
      )}
    </Box>
  );
}