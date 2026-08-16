import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    package_share = get_package_share_directory("tracero_agent")
    config_file = os.path.join(package_share, "config", "agent.yaml")

    return LaunchDescription(
        [
            Node(
                package="tracero_agent",
                executable="agent_node",
                name="tracero_agent",
                output="screen",
                parameters=[config_file],
            )
        ]
    )
