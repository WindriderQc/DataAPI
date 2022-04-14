curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt install -y nodejs
node -v

ip a



mkdir servers
cd servers

sudo npm install -g pm2
pm2 status
sudo apt install git
git clone https://github.com/WindriderQc/iGrow.git
cd iGrow
npm install
npm run dev