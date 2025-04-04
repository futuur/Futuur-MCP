import { z } from "zod";
export function registerCategoryTools(server) {
    // Tool to get categories
    server.tool("get_categories", {}, async () => {
        try {
            const response = await fetch("https://api.futuur.com/api/v1/categories");
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(data, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching categories: ${String(error)}`
                    }]
            };
        }
    });
    // Tool to get a specific category by ID
    server.tool("get_category_by_id", {
        id: z.number().describe("A unique integer value identifying this category")
    }, async ({ id }) => {
        try {
            const response = await fetch(`https://api.futuur.com/api/v1/categories/${id}/`);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(data, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching category with ID ${id}: ${String(error)}`
                    }]
            };
        }
    });
    // Tool to get featured categories
    server.tool("get_featured_categories", {}, async () => {
        try {
            const response = await fetch("https://api.futuur.com/api/v1/categories/featured/");
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(data, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching featured categories: ${String(error)}`
                    }]
            };
        }
    });
    // Tool to get root categories
    server.tool("get_root_categories", {}, async () => {
        try {
            const response = await fetch("https://api.futuur.com/api/v1/categories/root/");
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(data, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching root categories: ${String(error)}`
                    }]
            };
        }
    });
    // Tool to get root categories and main children
    server.tool("get_root_categories_and_main_children", {
        currency_mode: z.enum(["play_money", "real_money"]).describe("Currency mode: play_money or real_money"),
        search: z.string().optional().describe("Optional search term to filter categories")
    }, async ({ currency_mode, search }) => {
        try {
            const queryParams = new URLSearchParams({
                currency_mode: currency_mode
            });
            if (search) {
                queryParams.append("search", search);
            }
            const response = await fetch(`https://api.futuur.com/api/v1/categories/root_and_main_children/?${queryParams}`);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(data, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching root categories and main children: ${String(error)}`
                    }]
            };
        }
    });
}
