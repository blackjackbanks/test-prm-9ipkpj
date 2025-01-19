# VPC Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# Local variables for subnet configuration
locals {
  azs = data.aws_availability_zones.available.names
  public_subnets    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets   = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  database_subnets  = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
  vpc_flow_logs_retention = 30
}

# Main VPC
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr
  
  enable_dns_hostnames = true
  enable_dns_support   = true
  instance_tenancy     = "default"
  
  # IPv6 configuration
  enable_ipv6 = false
  assign_generated_ipv6_cidr_block = false
  
  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-vpc"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = 3

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-public-${count.index + 1}"
    "kubernetes.io/role/elb" = "1"
  })
}

# Private Subnets
resource "aws_subnet" "private" {
  count = 3

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-private-${count.index + 1}"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

# Database Subnets
resource "aws_subnet" "database" {
  count = 3

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.database_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db-${count.index + 1}"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-igw"
  })
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = 3
  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-nat-eip-${count.index + 1}"
  })
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count = 3

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-public-rt"
  })
}

resource "aws_route_table" "private" {
  count = 3
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-private-rt-${count.index + 1}"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = 3

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = 3

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = 3

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Network ACLs
resource "aws_network_acl" "main" {
  vpc_id = aws_vpc.main.id
  subnet_ids = concat(
    aws_subnet.public[*].id,
    aws_subnet.private[*].id,
    aws_subnet.database[*].id
  )

  ingress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    protocol   = -1
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-nacl"
  })
}

# VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  name              = "/aws/vpc/${aws_vpc.main.id}/flow-logs"
  retention_in_days = local.vpc_flow_logs_retention

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-vpc-flow-logs"
  })
}

resource "aws_iam_role" "vpc_flow_log" {
  name = "${local.project}-${local.environment}-vpc-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "vpc_flow_log" {
  name = "${local.project}-${local.environment}-vpc-flow-log-policy"
  role = aws_iam_role.vpc_flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect = "Allow"
        Resource = "${aws_cloudwatch_log_group.vpc_flow_log.arn}:*"
      }
    ]
  })
}

resource "aws_flow_log" "main" {
  vpc_id = aws_vpc.main.id
  traffic_type = "ALL"
  
  log_destination_type = "cloud-watch-logs"
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn
  iam_role_arn = aws_iam_role.vpc_flow_log.arn

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-flow-log"
  })
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}