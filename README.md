stars
=====

# Edit hosts file

```bash
sudo su -c "echo '192.168.1.203 stars.local' >> /etc/hosts"
```

# Install dependencies

Arch:

```bash
sudo pacman -S vagrant
```

Debian/Ubuntu/etc:

```bash
sudo apt-get install vagrant
```

# Provision the development server

```bash
vagrant up
```

# Run the development server

```bash
vagrant ssh
cd /vagrant
sudo nodejs src/server.js
```

Now visit https://stars.local/ in a browser.
