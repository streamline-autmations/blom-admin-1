import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProductEditor from "../components/ProductEditor";

export default function ProductCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    status: "draft",
    price: 0,
    compare_at_price: 0,
    stock: 0,
    sku: "",
    short_description: "",
    long_description: "",
    image_url: "",
    category: ""
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(createPageUrl("Products"));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <ProductEditor
      product={formData}
      onChange={setFormData}
      onSubmit={handleSubmit}
      onCancel={() => navigate(createPageUrl("Products"))}
      isLoading={createMutation.isPending}
      title="Create New Product"
    />
  );
}