FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run Vite dev server and expose it to the network so Docker can map the port
CMD ["npm", "run", "dev", "--", "--host"]
