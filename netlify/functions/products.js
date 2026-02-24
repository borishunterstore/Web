const { MongoClient } = require('mongodb');

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
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        
        const db = client.db('bhstore');
        const products = db.collection('products');
        
        const allProducts = await products.find({}).toArray();
        
        await client.close();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                products: allProducts
            })
        };
        
    } catch (error) {
        console.error('Products error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' })
        };
    }
};