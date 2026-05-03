import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const getAllWordsHandler: APIGatewayProxyHandlerV2 = async (event) => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "Hello from Lambda " + new Date().toISOString(),
    path: event.rawPath,
  }),
});

interface AddWordRequest {
  ruWord: string;
  srWordCyr?: string;
  srWordLat?: string;
  tags?: string[];
}

export const addWordHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body } = event;
  const addWordRequest: AddWordRequest = body ? JSON.parse(body) : {};
  if (
    !addWordRequest.ruWord ||
    (!addWordRequest.srWordCyr && !addWordRequest.srWordLat)
  ) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message:
          "Invalid request. 'ruWord' and at least one of 'srWordCyr' or 'srWordLat' are required.",
      }),
    };
  }
  return {
    statusCode: 201,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "'" + addWordRequest.ruWord + "' added",
      path: event.rawPath,
    }),
  };
};
