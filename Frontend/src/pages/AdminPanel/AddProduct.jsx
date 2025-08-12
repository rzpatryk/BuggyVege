import React, { useState } from 'react'
import upload_area from "../../assets/upload_area.png"
import { useLoginContext } from '../../context/LoginContext';
const AddProduct = ({ addProductUrl, fetchOptions }) => {

  const categories = [
  {
    text: "Organic veggies",
    path: "Vegetables",
    //image: organic_vegitable_image,
    bgColor: "#FEF6DA",
  },
  {
    text: "Fresh Fruits",
    path: "Fruits",
    //image: fresh_fruits_image,
    bgColor: "#FEE0E0",
  },
  {
    text: "Cold Drinks",
    path: "Drinks",
    //image: bottles_image,
    bgColor: "#F0F5DE",
  },
  {
    text: "Instant Food",
    path: "Instant",
    //image: maggi_image,
    bgColor: "#E1F5EC",
  },
  {
    text: "Dairy Products",
    path: "Dairy",
    //image: dairy_product_image,
    bgColor: "#FEE6CD",
  },
  {
    text: "Bakery & Breads",
    path: "Bakery",
    //image: bakery_image,
    bgColor: "#E0F6FE",
  },
  {
    text: "Grains & Cereals",
    path: "Grains",
    //image: grain_image,
    bgColor: "#F1E3F9",
  },
];

  const [files, setFiles] = useState([]);
  const [name, setName] = useState('');
  const [descriptions, setDescriptions] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const {mode} = useLoginContext();
  const onSubmitHandler = async (event) => {
    event.preventDefault();
    console.log("Token:", localStorage.getItem("token"));
    console.log("URL:", addProductUrl);
    console.log("fetchOptions:", fetchOptions);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('descriptions',  JSON.stringify(descriptions));
    formData.append('category', category);
    formData.append('price', price);
    formData.append('offerPrice', offerPrice);

    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]); // nazwę musi rozpoznać multer
    }
  try {
    const res = await fetch(addProductUrl, {
     method: 'POST',
      ...fetchOptions,
      headers: (mode === "MongoJWT" || mode === "MysqlJWT")
        ? {
            ...(fetchOptions.headers || {}),
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        : fetchOptions.headers,
      body: formData
  });

  if (!res.ok) {
    console.log(res);
    throw new Error('Błąd przy dodawaniu produktu');
  }

  const data = await res.json();
  console.log('Produkt dodany:', data);
  } catch (err) {
    console.error('Błąd:', err);
  }
  }
  
  return (
    <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
            <form onSubmit={onSubmitHandler}className="md:p-10 p-4 space-y-5 max-w-lg">
                <div>
                    <p className="text-base font-medium">Product Image</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {Array(4).fill('').map((_, index) => (
                            <label key={index} htmlFor={`image${index}`}>
                                <input onChange={(e)=>{
                                  const updatedFiles = [...files]
                                  updatedFiles[index] = e.target.files[0]
                                  setFiles(updatedFiles)
                                }}
                                type="file" id={`image${index}`} hidden />
                                <img className="max-w-24 cursor-pointer" 
                                src={files[index] ? URL.createObjectURL(files[index] ) : upload_area} alt="uploadArea" width={100} height={100} />
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-name">Product Name</label>
                    <input onChange={(e) => setName(e.target.value)} value={name}
                    id="product-name" type="text" placeholder="Type here" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                    <label className="text-base font-medium" htmlFor="product-description">Product Description</label>
                    <textarea onChange={(e) => setDescriptions(e.target.value)} value={descriptions}
                     id="product-description" rows={4} className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40 resize-none" placeholder="Type here"></textarea>
                </div>
                <div className="w-full flex flex-col gap-1">
                    <label className="text-base font-medium" htmlFor="category">Category</label>
                    <select onChange={(e) => setCategory(e.target.value)} value={category}
                    id="category" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40">
                        <option value="">Select Category</option>
                        {categories.map((item, index) => (
                            <option key={index} value={item.path}>{item.path}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="product-price">Product Price</label>
                        <input onChange={(e) => setPrice(e.target.value)} value={price}
                        id="product-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 w-32">
                        <label className="text-base font-medium" htmlFor="offer-price">Offer Price</label>
                        <input onChange={(e) => setOfferPrice(e.target.value)} value={offerPrice}
                        id="offer-price" type="number" placeholder="0" className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500/40" required />
                    </div>
                </div>
                <button className="px-8 py-2.5 bg-primary text-white font-medium rounded cursor-pointer">ADD</button>
            </form>
        </div>
  )
}

export default AddProduct