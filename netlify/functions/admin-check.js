exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const auth = event.headers.authorization?.replace('Bearer ', '');
        
        // Проверка токена (упрощенная для примера)
        let isAdmin = false;
        
        if (auth) {
            try {
                const decoded = JSON.parse(Buffer.from(auth, 'base64').toString());
                isAdmin = decoded.username === 'borisonchik_yt' || 
                          decoded.username === 'borisonchik' ||
                          decoded.id === '992442453833547886';
            } catch (e) {
                // Токен не валидный
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                isAdmin,
                message: 'Admin check successful'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Internal server error' })
        };
    }
};