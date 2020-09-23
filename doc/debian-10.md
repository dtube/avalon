```
#new node install procedure from debian 10:

sudo apt-get update
sudo apt-get upgrade
sudo apt-get install git wget tmux htop jq
git clone https://github.com/dtube/avalon.git
cd avalon/

#node+npm
sudo apt-get install nodejs npm

#if not on node v10, use nvm
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
nvm install v10
nvm use v10

#mongo
wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | sudo apt-key add -
echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.2.list
sudo apt-get update
sudo apt-get install -y mongodb-org

#npm packages
npm install
```
