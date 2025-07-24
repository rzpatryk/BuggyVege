const Product = require('../Models/Product');

exports.addProduct = async (req, res) => {
  try {
    const { name, descriptions, category, price, offerPrice } = req.body;

    // req.files jest uzupełnione przez multer w routerze
    const imagePaths = req.files.map(file => file.path);

    const product = new Product({
      name,
      descriptions: descriptions.split(',').map(s => s.trim()),
      category,
      price: parseFloat(price),
      offerPrice: parseFloat(offerPrice),
      images: imagePaths
    });

    await product.save();

    res.status(201).json({ message: 'Produkt zapisany', product });
  } catch (error) {
    console.error('Błąd dodawania produktu:', error);
    res.status(500).json({ error: 'Błąd serwera przy dodawaniu produktu' });
  }
};

// Pobierz wszystkie produkty (publiczne)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products
      }
    });
  } catch (error) {
    console.error('Błąd pobierania produktów:', error);
    res.status(500).json({ error: 'Błąd serwera przy pobieraniu produktów' });
  }
};

// Pobierz jeden produkt (publiczne)
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Produkt nie został znaleziony' });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Błąd pobierania produktu:', error);
    res.status(500).json({ error: 'Błąd serwera przy pobieraniu produktu' });
  }
};

// Usuń produkt (tylko admin)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Produkt nie został znaleziony' });
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    console.error('Błąd usuwania produktu:', error);
    res.status(500).json({ error: 'Błąd serwera przy usuwaniu produktu' });
  }
};
