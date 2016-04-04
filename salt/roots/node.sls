add_node_ppa:
  cmd.run:
    - name: curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
    - unless: test -f /etc/apt/sources.list.d/nodesource.list

install_node:
  pkg.installed:
    - pkgs:
      - nodejs

server_dependencies:
  npm.installed:
    - pkgs:
      - seedrandom
      - ws
      - cookie
      - cookie-parser
      - body-parser
      - express
      - express-session
      - html
      - ejs
      - passport
      - passport-local
      - mongodb
      - redis
      - nodemailer

config_file:
  file.symlink:
    - name: /vagrant/src/config.js
    - target: /vagrant/src/config.js.example
    - owner: vagrant
    - group: vagrant
    - unless: test -f /vagrant/src/config.js
