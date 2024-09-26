import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAiMessage, setCurrentAiMessage] = useState(null);
  const flatListRef = useRef(null);
  
  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    if (currentAiMessage) {
      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];
        if (lastMessage.sender === 'ai') {
          return [...prevMessages.slice(0, -1), currentAiMessage];
        } else {
          return [...prevMessages, currentAiMessage];
        }
      });
    }
  }, [currentAiMessage]);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const loadChatHistory = async () => {
    try {
      const storedMessages = await AsyncStorage.getItem('chatHistory');
      if (storedMessages !== null) {
        setMessages(JSON.parse(storedMessages));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (updatedMessages) => {
    try {
      await AsyncStorage.setItem('chatHistory', JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const clearChatHistory = async () => {
    try {
      await AsyncStorage.removeItem('chatHistory');
      setMessages([]);
      console.log('Chat history cleared');
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const fetchStreamingResponse = async (prompt) => {
    const apiUrl = 'https://chat-assist.bitcoinjungle.app/api/chat';
  
    console.log('Sending request to OpenAI API...');
    
    const myMessages = [
      ...messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: prompt }
    ];


    try {
      const response = await axios({
        method: 'post',
        url: apiUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          messages: myMessages,
          stream: true,
        },
        responseType: 'text',
        onDownloadProgress: (progressEvent) => {
          const chunk = progressEvent.currentTarget.response;
          processChunk(chunk);
        },
      });
  
      console.log('Received response from OpenAI API:', response.status, response.statusText);
  
    } catch (error) {
      console.error('Error fetching streaming response:', error);
      throw error;
    }
  };
  
  let accumulatedText = '';

  const processChunk = (chunk) => {
    const lines = chunk.split('\n').filter(line => line.trim() !== '');
  
    for (const line of lines) {
      if (line.includes('[DONE]')) {
        console.log('Received [DONE] signal');
        accumulatedText = '';
        return;
      }
      if (line.startsWith('data: ')) {
        console.log(line)
        try {
          const jsonData = JSON.parse(line.slice(6));
          const delta = jsonData.choices[0].delta;
          
          if (delta.content === undefined) {
            // Reset the message if content is undefined
            accumulatedText = '';
          } else {
            // Append the new content
            accumulatedText += delta.content;
          }
          
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.sender === 'ai') {
              const updatedAiMessage = {
                ...lastMessage,
                text: accumulatedText
              };
              return [...prevMessages.slice(0, -1), updatedAiMessage];
            } else {
              // Create new AI message
              const newAiMessage = {
                id: Date.now(),
                text: accumulatedText,
                sender: 'ai'
              };
              return [...prevMessages, newAiMessage];
            }
          });
        } catch (error) {
          console.error('Error parsing stream message:', error, 'for line:', line);
        }
      }
    }
  };
  
  const sendMessage = async () => {
    if (inputText.trim() === '') return;
  
    const userMessage = { id: Date.now(), text: inputText, sender: 'user' };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    saveChatHistory([...messages, userMessage]);
    setInputText('');
  
    setIsStreaming(true);
    try {
      await fetchStreamingResponse(inputText);
    } catch (error) {
      console.error('Error fetching response:', error);
    }
    setIsStreaming(false);
    
    // Save the final state of messages after streaming is complete
    saveChatHistory(messages);
  };

  const renderMessage = ({ item }) => (
    <View style={item.sender === 'user' ? styles.userMessage : styles.aiMessage}>
      <Text style={styles.senderLabel}>
        {item.sender === 'user' ? 'Me' : 'Educator'}
      </Text>
      <Text>{item.text}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 220 : 0}
    >
      <View style={styles.innerContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onLayout={scrollToBottom}
          onContentSizeChange={scrollToBottom}
        />
        <View style={styles.bottomContainer}>
          <TouchableOpacity onPress={clearChatHistory} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              onSubmitEditing={sendMessage}
            />
          </View>
        </View>
        {isStreaming && <Text style={styles.streamingIndicator}>Educator is typing...</Text>}
      </View>
    </KeyboardAvoidingView>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  inputContainer: {
    flex: 1,
    marginLeft: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  clearButton: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 5,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#FFFFFF', // White background for input
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6', // Light green background for user messages
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0', // Gray background for AI messages
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  senderLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 12,
    color: '#555', // Dark gray color for labels
  },
  streamingIndicator: {
    alignSelf: 'center',
    color: '#888',
    marginTop: 5,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});

export default ChatInterface;