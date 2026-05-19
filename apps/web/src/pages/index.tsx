import Head from 'next/head';
import { Box, Container, Heading, Text, VStack, Button, HStack, Input, Card, CardBody, Badge, Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { Brain, Search, Clock, FileCode, GitBranch, Settings } from 'lucide-react';
import MemoryList from '@/components/MemoryList';
import SearchBar from '@/components/SearchBar';
import TimelineView from '@/components/TimelineView';

export default function Home() {
  return (
    <>
      <Head>
        <title>ContextHub - AI Memory Dashboard</title>
        <meta name="description" content="ContextHub - Persistent AI Memory for Developers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Box minH="100vh" bg="gray.900" color="white">
        {/* Header */}
        <Box bg="gray.800" borderBottom="1px" borderColor="gray.700" px={6} py={4}>
          <Container maxW="container.xl">
            <HStack justify="space-between">
              <HStack spacing={3}>
                <Box p={2} bg="blue.500" borderRadius="lg">
                  <Brain size={24} />
                </Box>
                <Heading size="lg">ContextHub</Heading>
                <Badge colorScheme="green" variant="subtle">v1.0.0</Badge>
              </HStack>
              <HStack spacing={4}>
                <Button leftIcon={<Settings size={16} />} variant="ghost" size="sm">
                  Settings
                </Button>
                <Button colorScheme="blue" size="sm">
                  Connect MCP
                </Button>
              </HStack>
            </HStack>
          </Container>
        </Box>

        {/* Main Content */}
        <Container maxW="container.xl" py={8}>
          <Tabs variant="soft-rounded" colorScheme="blue">
            <TabList mb={6}>
              <Tab><HStack><Brain size={16} /><Text>Memories</Text></HStack></Tab>
              <Tab><HStack><Clock size={16} /><Text>Timeline</Text></HStack></Tab>
              <Tab><HStack><GitBranch size={16} /><Text>Git</Text></HStack></Tab>
              <Tab><HStack><FileCode size={16} /><Text>Code</Text></HStack></Tab>
            </TabList>

            <TabPanels>
              {/* Memories Tab */}
              <TabPanel px={0}>
                <VStack spacing={6} align="stretch">
                  <SearchBar />
                  <Card bg="gray.800" border="1px" borderColor="gray.700">
                    <CardBody>
                      <MemoryList />
                    </CardBody>
                  </Card>
                </VStack>
              </TabPanel>

              {/* Timeline Tab */}
              <TabPanel px={0}>
                <TimelineView />
              </TabPanel>

              {/* Git Tab */}
              <TabPanel px={0}>
                <Card bg="gray.800" border="1px" borderColor="gray.700">
                  <CardBody>
                    <Heading size="md" mb={4}>Git Integration</Heading>
                    <Text color="gray.400">Connect to a repository to see git history and changes.</Text>
                  </CardBody>
                </Card>
              </TabPanel>

              {/* Code Tab */}
              <TabPanel px={0}>
                <Card bg="gray.800" border="1px" borderColor="gray.700">
                  <CardBody>
                    <Heading size="md" mb={4}>Code Architecture</Heading>
                    <Text color="gray.400">Repository analysis will be displayed here.</Text>
                  </CardBody>
                </Card>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Container>
      </Box>
    </>
  );
}