system_hostname:
  cmd.run:
    - name: hostnamectl set-hostname stars.local
    - unless: grep "stars.local" /etc/hostname

system_hosts:
  file.replace:
    - name: /etc/hosts
    - pattern: 127.0.0.1 localhost
    - repl: 127.0.0.1 localhost stars.local
    - unless: grep "stars.local" /etc/hosts
