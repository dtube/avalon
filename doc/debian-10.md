# Avalon install procedure for debian 10:

Make sure debian is up-to-date and download git and a few other packages from the debian repos.
```bash
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install git wget tmux htop jq unzip
git clone https://github.com/dtube/avalon.git
cd avalon/
```

Install NodeJS + NPM
```bash
sudo apt-get install nodejs npm
```

Check node version with `node -v`. Avalon runs with node v14 and v16 only. If needed, install NVM and install and use other node versions:
```bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install v16
nvm use v16
```

Now install MongoDB:
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | sudo apt-key add -
echo "deb http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.2.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Enable and start MongoDB deamon:
```
sudo systemctl enable mongod
sudo systemctl start mongod
```

And install NPM modules that Avalon uses.
```bash
npm install
```

Then, you should be able to launch an avalon development chain by running the node with `./scripts/start.sh`. If you want to connect to an existing network, read [Syncing your node](./syncing-your-node.md) doc.
