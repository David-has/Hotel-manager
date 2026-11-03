CREATE DATABASE IF NOT EXISTS hotel CHARACTER SET utf8mb4;
USE hotel;
DROP TABLE IF EXISTS bookings, guests, rooms, room_types;

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  capacity TINYINT NOT NULL
);
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(10) NOT NULL UNIQUE,
  floor TINYINT NOT NULL,
  type_id INT NOT NULL,
  status ENUM('available','occupied','cleaning','maintenance') DEFAULT 'available',
  FOREIGN KEY (type_id) REFERENCES room_types(id)
);
CREATE TABLE guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(30),
  country VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL,
  room_id INT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed','checked_in','checked_out','cancelled') DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guest_id) REFERENCES guests(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  CHECK (check_out > check_in)
);

INSERT INTO room_types (name, price, capacity) VALUES ('Standard',280,2),('Deluxe',420,3),('Suită',750,4);
INSERT INTO rooms (number, floor, type_id, status) VALUES
 ('101',1,1,'available'),('102',1,1,'available'),('103',1,1,'cleaning'),('104',1,2,'available'),
 ('201',2,1,'available'),('202',2,2,'available'),('203',2,2,'maintenance'),('204',2,2,'available'),
 ('301',3,3,'available'),('302',3,3,'available'),('303',3,2,'available'),('304',3,1,'available');
INSERT INTO guests (full_name, email, phone, country) VALUES
 ('Ioana Pop','ioana.pop@example.com','+40 722 000 111','România'),
 ('Marc Dubois','marc.dubois@example.com','+33 6 12 34 56 78','Franța'),
 ('Anna Keller','anna.keller@example.com','+49 151 2345 678','Germania'),
 ('Andrei Muntean','andrei.m@example.com','+40 744 222 333','România');
INSERT INTO bookings (guest_id, room_id, check_in, check_out, total, status) VALUES
 (1,1,CURDATE(),DATE_ADD(CURDATE(),INTERVAL 2 DAY),560,'confirmed'),
 (2,9,DATE_SUB(CURDATE(),INTERVAL 1 DAY),CURDATE(),750,'checked_in'),
 (3,4,DATE_ADD(CURDATE(),INTERVAL 3 DAY),DATE_ADD(CURDATE(),INTERVAL 6 DAY),1260,'confirmed'),
 (4,6,DATE_SUB(CURDATE(),INTERVAL 4 DAY),DATE_SUB(CURDATE(),INTERVAL 1 DAY),1260,'checked_out');
UPDATE rooms SET status='occupied' WHERE number='301';
