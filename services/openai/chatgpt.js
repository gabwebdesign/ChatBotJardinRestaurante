import { Configuration, OpenAIApi } from "openai";

/**
 * 
 * @returns 
 */
const completion = async (dataIn = '') => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  
  try {
    // Construct the messages array for the chat model
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo', // Use the chat model
      messages: [{ role: 'user', content: dataIn }], // Pass input as a message
      max_tokens: 250, // Limit for the response
      temperature: 0, // Control the randomness
    });
    return response

  } catch (error) {
    // Log any errors that occur during the request
    console.error('Error during API call:', error);
    return 'An error occurred while contacting the AI.';
  }
};

export default { completion };
