export const errorHandler = (isProduction) => (err, req, res, _next) => {
    console.error(`Error: ${err.message}`);
    const isMalformedJson = err instanceof SyntaxError && err?.type === 'entity.parse.failed';
    const isPayloadTooLarge = err?.type === 'entity.too.large';
    const isUploadTooLarge = err?.code === 'LIMIT_FILE_SIZE';
    const isUploadValidation = /^Only .+ allowed/i.test(String(err?.message || ''));
    const isDatabaseValidation = err?.name === 'ValidationError' || err?.name === 'CastError';
    const isCorsError = err?.message === 'Not allowed by CORS';
    const statusCode = isMalformedJson || isUploadValidation || isDatabaseValidation
        ? 400
        : isPayloadTooLarge || isUploadTooLarge
            ? 413
            : isCorsError
                ? 403
                : err.statusCode || err.status || 500;
    const publicMessage = isMalformedJson
        ? 'Malformed JSON request body.'
        : isPayloadTooLarge
            ? 'Request body is too large.'
            : isUploadTooLarge
                ? 'File is too large. Maximum size is 5 MB.'
                : isDatabaseValidation
                    ? 'Invalid request data.'
                    : statusCode >= 500 && isProduction
                        ? 'Internal Server Error'
                        : err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message: publicMessage,
    });
};
