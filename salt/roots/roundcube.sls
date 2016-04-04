roundcube_packages:
  pkg.installed:
    - pkgs:
      - apache2
      - roundcube
      - roundcube-sqlite3

roundcube_apache_conf_delete:
  file.absent:
    - name: /etc/apache2/conf-available/roundcube.conf

roundcube_apache_conf:
  file.managed:
    - name: /etc/apache2/conf-available/roundcube.conf
    - source: /srv/salt/files/roundcube.conf

roundcube_enable_php_mcrypt:
  cmd.run:
    - name: php5enmod mcrypt

roundcube_conf:
  file.replace:
    - name: /etc/roundcube/main.inc.php
    - pattern: \$rcmail_config\['default_host'\] = '';
    - repl: $rcmail_config['default_host'] = 'localhost';

roundcube_apache_restart:
  service.running:
    - name: apache2
    - reload: True
    - watch:
      - file: roundcube_apache_conf
      - cmd: roundcube_enable_php_mcrypt
      - file: roundcube_conf
