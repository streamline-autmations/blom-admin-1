// Script to add variant manually via save-product API

async function addVariant() {
  try {
    // First, let's find the product by SKU
    const findResponse = await fetch('https://blom-admin.netlify.app/.netlify/functions/admin-product?slug=core-acrylics');
    
    if (!findResponse.ok) {
      console.error('Product not found with slug core-acrylics');
      return;
    }
    
    const findData = await findResponse.json();
    const product = findData.product;
    
    console.log('Found product:', product.name);
    console.log('Product ID:', product.id);
    
    // Now update with the new variant using save-product
    const updateData = {
      id: product.id,
      partial_update: true,
      variants: [
        ...(product.variants || []),
        {
          name: "Sweet Peach",
          image: "https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg"
        }
      ]
    };
    
    const saveResponse = await fetch('https://blom-admin.netlify.app/.netlify/functions/save-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    const saveResult = await saveResponse.json();
    
    if (saveResponse.ok && saveResult.ok) {
      console.log('✅ Successfully added variant "Sweet Peach" to Core Acrylics!');
      console.log('Updated variants:', JSON.stringify(saveResult.product.variants, null, 2));
    } else {
      console.error('Failed to update:', saveResult.error);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addVariant();