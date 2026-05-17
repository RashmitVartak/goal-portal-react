#!/bin/bash
cd "$(dirname "$0")/client"
npm install
npm run build
cp -r dist/* ../server/static/
cd ../server
pip install -r requirements.txt
python -c "from database import init_db, seed_data; init_db(); seed_data(); print('DB ready')"
